import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Refresh access token if needed
async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();
    if (data.access_token) {
      return data.access_token;
    }
    console.error('[GoogleDrive Import] Refresh failed:', data);
    return null;
  } catch (error) {
    console.error('[GoogleDrive Import] Refresh error:', error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { file_id, file_name, mime_type, conversation_id } = await req.json();

    if (!file_id) {
      return new Response(JSON.stringify({ error: 'file_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's Google Drive integration
    const { data: integration, error: intError } = await supabase
      .from('chat_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('integration_type', 'googledrive')
      .eq('is_active', true)
      .single();

    if (intError || !integration) {
      return new Response(JSON.stringify({ 
        error: 'Google Drive not connected',
        code: 'NOT_CONNECTED'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let accessToken = integration.encrypted_access_token;

    // Check if token is expired and refresh if needed
    if (integration.token_expires_at && new Date(integration.token_expires_at) < new Date()) {
      if (integration.encrypted_refresh_token) {
        const newToken = await refreshAccessToken(integration.encrypted_refresh_token);
        if (newToken) {
          accessToken = newToken;
          // Update stored token
          await supabase
            .from('chat_integrations')
            .update({ 
              encrypted_access_token: newToken,
              token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
            })
            .eq('id', integration.id);
        } else {
          return new Response(JSON.stringify({ 
            error: 'Token refresh failed. Please reconnect Google Drive.',
            code: 'TOKEN_EXPIRED'
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // Get file metadata first
    const metaResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${file_id}?fields=name,mimeType,size`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!metaResponse.ok) {
      const error = await metaResponse.json();
      console.error('[GoogleDrive Import] Metadata fetch failed:', error);
      return new Response(JSON.stringify({ error: 'Failed to get file info' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fileMeta = await metaResponse.json();
    const fileName = file_name || fileMeta.name;
    const mimeType = mime_type || fileMeta.mimeType;
    const fileSize = parseInt(fileMeta.size || '0');

    console.log('[GoogleDrive Import] Importing file:', fileName, mimeType, fileSize);

    // Determine how to download based on mime type
    let downloadUrl: string;
    let exportMimeType: string | null = null;

    if (mimeType.startsWith('application/vnd.google-apps')) {
      // Google Docs/Sheets/Slides - need to export
      const exportMap: Record<string, string> = {
        'application/vnd.google-apps.document': 'application/pdf',
        'application/vnd.google-apps.spreadsheet': 'text/csv',
        'application/vnd.google-apps.presentation': 'application/pdf',
      };
      exportMimeType = exportMap[mimeType] || 'application/pdf';
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${file_id}/export?mimeType=${encodeURIComponent(exportMimeType)}`;
    } else {
      // Regular file - direct download
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${file_id}?alt=media`;
    }

    // Download file content
    const fileResponse = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!fileResponse.ok) {
      const error = await fileResponse.text();
      console.error('[GoogleDrive Import] Download failed:', error);
      return new Response(JSON.stringify({ error: 'Failed to download file' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fileBlob = await fileResponse.blob();
    const actualFileSize = fileBlob.size;

    // Create processing job
    const jobId = crypto.randomUUID();
    const finalFileName = exportMimeType 
      ? fileName.replace(/\.[^.]+$/, '') + (exportMimeType === 'text/csv' ? '.csv' : '.pdf')
      : fileName;
    const storagePath = `${user.id}/${conversation_id || 'general'}/${jobId}/${finalFileName}`;

    // Determine handler based on file type
    const handlerMap: Record<string, string> = {
      'application/pdf': 'pdf',
      'text/csv': 'csv',
      'text/plain': 'txt',
      'text/markdown': 'md',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    };
    const handler = handlerMap[exportMimeType || mimeType] || 'txt';

    // Create job record
    const { error: jobError } = await supabase.from('document_processing_jobs').insert({
      id: jobId,
      conversation_id: conversation_id || null,
      user_id: user.id,
      file_name: finalFileName,
      file_size: actualFileSize,
      file_type: exportMimeType || mimeType,
      handler,
      storage_path: storagePath,
      status: 'uploading',
      progress: 20,
    });

    if (jobError) {
      console.error('[GoogleDrive Import] Job creation failed:', jobError);
      return new Response(JSON.stringify({ error: 'Failed to create processing job' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, fileBlob, {
        contentType: exportMimeType || mimeType,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('[GoogleDrive Import] Storage upload failed:', uploadError);
      await supabase.from('document_processing_jobs')
        .update({ status: 'failed', error_message: uploadError.message })
        .eq('id', jobId);
      return new Response(JSON.stringify({ error: 'Failed to store file' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update job status
    await supabase.from('document_processing_jobs')
      .update({ status: 'queued', progress: 30 })
      .eq('id', jobId);

    // Trigger embed-document for processing
    const embedResponse = await fetch(
      `${SUPABASE_URL}/functions/v1/embed-document`,
      {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          job_id: jobId,
          storage_path: storagePath,
          conversation_id,
          handler,
        }),
      }
    );

    if (!embedResponse.ok) {
      const error = await embedResponse.json().catch(() => ({}));
      console.error('[GoogleDrive Import] Embed trigger failed:', error);
    }

    console.log('[GoogleDrive Import] Successfully queued file:', finalFileName, jobId);

    return new Response(JSON.stringify({
      success: true,
      type: 'document',
      job_id: jobId,
      filename: finalFileName,
      file_size: actualFileSize,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[GoogleDrive Import] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
