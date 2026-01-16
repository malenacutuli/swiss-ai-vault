import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VideoRequest {
  action: 'create_storyboard' | 'generate_video' | 'get_status';
  artifactId?: string;
  sourceIds?: string[];
  notebookId?: string;
  options?: {
    duration: 'brief' | 'standard' | 'detailed';
    style: 'simple' | 'standard' | 'cinematic';
    resolution: '720p' | '1080p' | '4K';
    narratorVoice: string;
    focusPrompt?: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { action, artifactId, sourceIds, notebookId, options } = await req.json() as VideoRequest;

    console.log(`[video-generator] Action: ${action}, User: ${userId}`);

    switch (action) {
      case 'create_storyboard': {
        if (!sourceIds || sourceIds.length === 0) {
          throw new Error('No sources provided');
        }

        // Fetch source content
        const { data: chunks, error: chunksError } = await supabase
          .from('source_chunks')
          .select('content, source_id')
          .in('source_id', sourceIds)
          .order('chunk_index');

        if (chunksError) {
          console.error('[video-generator] Error fetching chunks:', chunksError);
          throw new Error('Failed to fetch source content');
        }

        const sourceContent = chunks?.map(c => c.content).join('\n\n') || '';
        
        if (!sourceContent) {
          throw new Error('No content found in sources');
        }

        // Generate storyboard
        const storyboard = await generateStoryboard(
          sourceContent, 
          options?.duration || 'standard',
          options?.focusPrompt
        );

        // Calculate duration
        const durationMap = { brief: 60, standard: 120, detailed: 180 };
        const durationSeconds = durationMap[options?.duration || 'standard'];

        // Create artifact record
        const { data: artifact, error: artifactError } = await supabase
          .from('artifacts')
          .insert({
            user_id: userId,
            notebook_id: notebookId,
            artifact_type: 'video_summary',
            title: storyboard.title,
            status: 'draft',
            style_preset: options?.style || 'standard',
            duration_seconds: durationSeconds,
            resolution: options?.resolution || '1080p',
            generation_params: options
          })
          .select()
          .single();

        if (artifactError) {
          console.error('[video-generator] Error creating artifact:', artifactError);
          throw new Error('Failed to create artifact record');
        }

        // Store storyboard
        const { error: storyboardError } = await supabase
          .from('video_storyboards')
          .insert({
            artifact_id: artifact.id,
            scenes: storyboard.scenes,
            narrator_voice: options?.narratorVoice || 'alloy',
            total_duration_seconds: durationSeconds
          });

        if (storyboardError) {
          console.error('[video-generator] Error storing storyboard:', storyboardError);
        }

        console.log(`[video-generator] Created storyboard for artifact: ${artifact.id}`);

        return new Response(JSON.stringify({ 
          success: true, 
          artifactId: artifact.id,
          storyboard 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'generate_video': {
        if (!artifactId) throw new Error('Missing artifactId');

        // Update status to processing
        await supabase
          .from('artifacts')
          .update({ status: 'processing', started_at: new Date().toISOString() })
          .eq('id', artifactId);

        // Fetch storyboard
        const { data: storyboard, error: storyboardError } = await supabase
          .from('video_storyboards')
          .select('*')
          .eq('artifact_id', artifactId)
          .single();

        if (storyboardError || !storyboard) {
          console.error('[video-generator] Storyboard not found:', storyboardError);
          throw new Error('Storyboard not found');
        }

        const scenes = storyboard.scenes as any[];
        
        // Generate placeholder assets for each scene
        for (let i = 0; i < scenes.length; i++) {
          const scene = scenes[i];
          // In production, generate real images and audio here
          scenes[i].image_url = `https://placehold.co/1920x1080/1D4E5F/white?text=Scene+${i + 1}`;
          scenes[i].audio_url = null; // Would be generated with TTS
        }

        // Update storyboard with generated assets
        await supabase
          .from('video_storyboards')
          .update({ scenes, user_edited: false })
          .eq('artifact_id', artifactId);

        // Mark as completed
        await supabase
          .from('artifacts')
          .update({ 
            status: 'completed', 
            completed_at: new Date().toISOString() 
          })
          .eq('id', artifactId);

        console.log(`[video-generator] Completed video generation for: ${artifactId}`);

        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Video generation complete',
          scenes 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get_status': {
        if (!artifactId) throw new Error('Missing artifactId');

        const { data: artifact, error } = await supabase
          .from('artifacts')
          .select('*, video_storyboards(*)')
          .eq('id', artifactId)
          .single();

        if (error) {
          console.error('[video-generator] Error fetching status:', error);
          throw new Error('Failed to fetch artifact status');
        }

        return new Response(JSON.stringify({ 
          success: true, 
          artifact 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('[video-generator] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function generateStoryboard(
  content: string,
  duration: 'brief' | 'standard' | 'detailed',
  focusPrompt?: string
): Promise<{ title: string; scenes: any[] }> {
  const durationGuide = {
    brief: '60 seconds (4-5 scenes, ~12 seconds each)',
    standard: '120 seconds (6-8 scenes, ~15 seconds each)',
    detailed: '180 seconds (10-12 scenes, ~15 seconds each)'
  };

  const sceneCount = duration === 'brief' ? 5 : duration === 'standard' ? 7 : 10;

  // For now, create a structured storyboard based on content analysis
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
  const keyPoints = sentences.slice(0, sceneCount);
  
  const title = focusPrompt || 'Content Summary';
  
  const scenes = keyPoints.map((point, index) => ({
    index,
    duration_seconds: Math.floor(duration === 'brief' ? 12 : 15),
    script: point.trim(),
    visual_prompt: `Professional illustration of: ${point.trim().substring(0, 100)}`,
    audio_cue: index === 0 ? 'upbeat intro music' : '',
    key_point: point.trim().substring(0, 50) + '...'
  }));

  // Ensure we have at least one scene
  if (scenes.length === 0) {
    scenes.push({
      index: 0,
      duration_seconds: 15,
      script: 'Welcome to this summary of the content.',
      visual_prompt: 'Professional tech illustration, corporate blue theme',
      audio_cue: 'upbeat intro music',
      key_point: 'Introduction'
    });
  }

  return { title, scenes };
}
