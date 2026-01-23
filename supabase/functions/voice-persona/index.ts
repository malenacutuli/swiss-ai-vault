// Voice Persona Edge Function
// WebSocket proxy to PersonaPlex for real-time voice conversations

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-persona',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// PersonaPlex server endpoint (Swiss K8s)
const PERSONAPLEX_URL = Deno.env.get('PERSONAPLEX_URL') || 'wss://voice.swissbrain.ai';

// Pre-defined SwissVault personas with voice and prompt configuration
const PERSONAS: Record<string, { voice: string; prompt: string }> = {
  'health-advisor': {
    voice: 'NATF2',
    prompt: `You are a Swiss healthcare advisor named Dr. Aria. You speak clearly, warmly, and professionally.
Your role is to help patients understand their medical records, explain diagnoses in simple terms, and provide
general health guidance. You always recommend consulting with a licensed physician for medical decisions.
You maintain HIPAA-compliant privacy standards and never store or share patient information.
You are empathetic, patient, and thorough in your explanations.`
  },
  'financial-analyst': {
    voice: 'NATM1',
    prompt: `You are a Swiss private banking advisor named Marcus. You speak with authority, discretion, and confidence.
Your role is to help clients understand their portfolio, analyze market conditions, and discuss investment strategies.
You maintain strict confidentiality and comply with FINMA regulations.
You are knowledgeable about Swiss banking, wealth management, and international finance.
You never provide specific investment advice without appropriate disclaimers.`
  },
  'legal-assistant': {
    voice: 'VARF1',
    prompt: `You are a Swiss legal assistant named Elena. You speak precisely and professionally.
Your role is to help review documents, explain legal terminology, and assist with legal research.
You always clarify that you cannot provide legal advice and recommend consulting with a licensed attorney.
You are familiar with Swiss law, EU regulations, and international business law.
You are detail-oriented and thorough in your analysis.`
  },
  'research-assistant': {
    voice: 'NATM0',
    prompt: `You are a research assistant named Atlas. You speak clearly and analytically.
Your role is to help with academic and business research, analyze documents, summarize findings,
and synthesize information from multiple sources. You are objective, thorough, and cite sources when possible.
You help users explore topics deeply and understand complex subjects.`
  },
  'executive-assistant': {
    voice: 'NATF0',
    prompt: `You are an executive assistant named Clara. You speak efficiently and professionally.
Your role is to help with scheduling, task management, email drafting, and meeting preparation.
You are organized, proactive, and anticipate needs. You help prioritize tasks and manage time effectively.
You maintain confidentiality for all business matters.`
  }
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Check for WebSocket upgrade
    const upgrade = req.headers.get('upgrade') || '';
    if (upgrade.toLowerCase() !== 'websocket') {
      // Return available personas for non-WebSocket requests
      return new Response(
        JSON.stringify({
          personas: Object.keys(PERSONAS).map(id => ({
            id,
            voice: PERSONAS[id].voice,
            description: PERSONAS[id].prompt.split('\n')[0]
          })),
          endpoint: 'wss://your-project.supabase.co/functions/v1/voice-persona',
          usage: 'Connect via WebSocket with X-Persona header'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check subscription tier (voice requires Pro+)
    const { data: subscription } = await supabase
      .from('unified_subscriptions')
      .select('tier, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    const allowedTiers = ['ghost_pro', 'ghost_premium', 'ghost_enterprise', 'pro', 'premium', 'enterprise'];
    if (!subscription || !allowedTiers.includes(subscription.tier)) {
      return new Response(
        JSON.stringify({ error: 'Voice features require Pro subscription' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get persona from header or default
    const personaId = req.headers.get('X-Persona') || 'research-assistant';
    const persona = PERSONAS[personaId] || PERSONAS['research-assistant'];

    // Upgrade to WebSocket
    const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

    // Connect to PersonaPlex backend
    const backendSocket = new WebSocket(PERSONAPLEX_URL);

    // Track connection for billing
    const sessionStart = Date.now();
    let audioSeconds = 0;

    backendSocket.onopen = () => {
      console.log(`[VoicePersona] Connected to PersonaPlex for user ${user.id.slice(0, 8)}, persona: ${personaId}`);

      // Send persona configuration to PersonaPlex
      backendSocket.send(JSON.stringify({
        type: 'config',
        voice: persona.voice,
        prompt: persona.prompt,
        user_id: user.id
      }));
    };

    // Proxy messages from client to PersonaPlex
    clientSocket.onmessage = (event) => {
      if (backendSocket.readyState === WebSocket.OPEN) {
        backendSocket.send(event.data);

        // Track audio duration for billing (assuming 16kHz mono PCM)
        if (event.data instanceof ArrayBuffer) {
          audioSeconds += event.data.byteLength / (16000 * 2); // 16kHz, 16-bit
        }
      }
    };

    // Proxy messages from PersonaPlex to client
    backendSocket.onmessage = (event) => {
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(event.data);
      }
    };

    // Handle client disconnect
    clientSocket.onclose = async () => {
      console.log(`[VoicePersona] Client disconnected, session duration: ${(Date.now() - sessionStart) / 1000}s`);
      backendSocket.close();

      // Log usage for billing
      const sessionDuration = (Date.now() - sessionStart) / 1000;
      try {
        await supabase.from('voice_usage').insert({
          user_id: user.id,
          persona: personaId,
          session_duration_seconds: sessionDuration,
          audio_seconds: audioSeconds,
          created_at: new Date().toISOString()
        } as Record<string, unknown>);
      } catch (err) {
        console.error('[VoicePersona] Usage logging error:', err);
      }
    };

    // Handle backend disconnect
    backendSocket.onclose = () => {
      console.log('[VoicePersona] PersonaPlex disconnected');
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.close(1000, 'Backend disconnected');
      }
    };

    // Handle errors
    clientSocket.onerror = (e) => console.error('[VoicePersona] Client error:', e);
    backendSocket.onerror = (e) => console.error('[VoicePersona] Backend error:', e);

    return response;

  } catch (error) {
    console.error('[VoicePersona] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
