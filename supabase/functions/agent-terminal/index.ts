// Agent Terminal Edge Function
// Proxies terminal output from E2B sandbox to frontend
// Enables real-time terminal display like Manus.im

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { authenticateToken, extractToken } from '../_shared/cross-project-auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AGENT_API_URL = Deno.env.get('AGENT_API_URL') || 'https://api.swissbrain.ai';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const token = extractToken(req.headers.get('Authorization'));
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authResult = await authenticateToken(token, supabase);
    if (!authResult.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = authResult.user.id;

    // Parse request
    const body = await req.json();
    const { run_id, sandbox_id, action } = body;

    if (!run_id) {
      return new Response(JSON.stringify({ error: 'run_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user owns this run
    const { data: run } = await supabase
      .from('agent_runs')
      .select('user_id, sandbox_id')
      .eq('id', run_id)
      .single();

    if (!run || run.user_id !== userId) {
      return new Response(JSON.stringify({ error: 'Run not found or access denied' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const targetSandboxId = sandbox_id || run.sandbox_id;

    switch (action) {
      case 'get_output':
        return await getTerminalOutput(supabase, run_id);
      
      case 'get_files':
        return await getFileList(supabase, run_id, body.path);
      
      case 'get_file_content':
        return await getFileContent(supabase, run_id, body.path);
      
      case 'get_preview_url':
        return await getPreviewUrl(supabase, run_id);
      
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

  } catch (error) {
    console.error('[agent-terminal] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Get terminal output from logs
async function getTerminalOutput(supabase: any, runId: string) {
  // Get shell execution logs
  const { data: logs } = await supabase
    .from('agent_task_logs')
    .select('*')
    .eq('run_id', runId)
    .in('log_type', ['shell_command', 'shell_output', 'code_execution', 'tool_output'])
    .order('created_at', { ascending: true });

  // Format as terminal output
  const terminalLines: string[] = [];
  
  for (const log of logs || []) {
    if (log.log_type === 'shell_command') {
      terminalLines.push(`\x1b[32m$\x1b[0m ${log.content}`);
    } else if (log.log_type === 'shell_output') {
      terminalLines.push(log.content);
    } else if (log.log_type === 'code_execution') {
      terminalLines.push(`\x1b[36m>>> Executing code...\x1b[0m`);
      if (log.metadata?.code) {
        terminalLines.push(log.metadata.code);
      }
    } else if (log.log_type === 'tool_output') {
      terminalLines.push(`\x1b[33m[${log.metadata?.tool || 'tool'}]\x1b[0m ${log.content}`);
    }
  }

  return new Response(JSON.stringify({
    output: terminalLines.join('\n'),
    lines: terminalLines,
    log_count: logs?.length || 0,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Get file list from sandbox
async function getFileList(supabase: any, runId: string, path: string = '/home/user') {
  // Get file operations from logs
  const { data: logs } = await supabase
    .from('agent_task_logs')
    .select('*')
    .eq('run_id', runId)
    .eq('log_type', 'file_operation')
    .order('created_at', { ascending: false });

  // Extract unique files
  const files = new Map<string, any>();
  
  for (const log of logs || []) {
    const filePath = log.metadata?.path;
    if (filePath && filePath.startsWith(path)) {
      files.set(filePath, {
        path: filePath,
        name: filePath.split('/').pop(),
        type: log.metadata?.type || 'file',
        size: log.metadata?.size || 0,
        modified: log.created_at,
      });
    }
  }

  // Also get from agent_task_outputs
  const { data: outputs } = await supabase
    .from('agent_task_outputs')
    .select('*')
    .eq('run_id', runId);

  for (const output of outputs || []) {
    files.set(output.file_name, {
      path: `/outputs/${output.file_name}`,
      name: output.file_name,
      type: 'file',
      size: output.file_size_bytes || 0,
      url: output.download_url,
    });
  }

  return new Response(JSON.stringify({
    path,
    files: Array.from(files.values()),
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Get file content
async function getFileContent(supabase: any, runId: string, path: string) {
  // Check outputs first
  const { data: output } = await supabase
    .from('agent_task_outputs')
    .select('*')
    .eq('run_id', runId)
    .eq('file_name', path.split('/').pop())
    .single();

  if (output) {
    return new Response(JSON.stringify({
      path,
      content: output.content_preview || '',
      url: output.download_url,
      mime_type: output.mime_type,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check logs for file content
  const { data: log } = await supabase
    .from('agent_task_logs')
    .select('*')
    .eq('run_id', runId)
    .eq('log_type', 'file_operation')
    .eq('metadata->>path', path)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (log?.metadata?.content) {
    return new Response(JSON.stringify({
      path,
      content: log.metadata.content,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'File not found' }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Get preview URL for dev server
async function getPreviewUrl(supabase: any, runId: string) {
  // Get run with sandbox info
  const { data: run } = await supabase
    .from('agent_runs')
    .select('sandbox_id, metadata')
    .eq('id', runId)
    .single();

  if (!run) {
    return new Response(JSON.stringify({ error: 'Run not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check for preview URL in metadata
  const previewUrl = run.metadata?.preview_url || run.metadata?.dev_server_url;
  
  if (previewUrl) {
    return new Response(JSON.stringify({
      url: previewUrl,
      sandbox_id: run.sandbox_id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check logs for dev server start
  const { data: log } = await supabase
    .from('agent_task_logs')
    .select('*')
    .eq('run_id', runId)
    .eq('log_type', 'dev_server_started')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (log?.metadata?.url) {
    return new Response(JSON.stringify({
      url: log.metadata.url,
      port: log.metadata.port,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ 
    error: 'No preview available',
    message: 'Dev server not started yet',
  }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
