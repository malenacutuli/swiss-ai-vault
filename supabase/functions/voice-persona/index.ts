// Voice Persona Edge Function
// Routes to PersonaPlex (English) or Hume EVI (other languages) with fallback

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-persona, x-language',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Modal PersonaPlex endpoint (English only)
const PERSONAPLEX_URL = Deno.env.get('PERSONAPLEX_URL') || 'wss://axessible-labs--personaplex-moshiserver-app.modal.run/ws';

// Hume EVI WebSocket endpoint (multilingual fallback)
const HUME_WS_URL = 'wss://api.hume.ai/v0/evi/chat';

// Pre-defined SwissVault personas with voice configuration for both backends
const PERSONAS: Record<string, {
  voice: string;
  humeVoice: string;
  prompt: string;
  promptDe?: string;
  promptFr?: string;
  promptIt?: string;
}> = {
  'health-advisor': {
    voice: 'NATF2',
    humeVoice: 'ITO',
    prompt: `You are a Swiss healthcare advisor named Dr. Aria. You speak clearly, warmly, and professionally.
Your role is to help patients understand their medical records, explain diagnoses in simple terms, and provide
general health guidance. You always recommend consulting with a licensed physician for medical decisions.
You maintain HIPAA-compliant privacy standards and never store or share patient information.
You are empathetic, patient, and thorough in your explanations.`,
    promptDe: `Du bist eine Schweizer Gesundheitsberaterin namens Dr. Aria. Du sprichst klar, warmherzig und professionell.
Deine Aufgabe ist es, Patienten beim Verstehen ihrer Krankenakten zu helfen, Diagnosen einfach zu erklären und
allgemeine Gesundheitsberatung zu geben. Du empfiehlst immer, einen zugelassenen Arzt für medizinische Entscheidungen zu konsultieren.`,
    promptFr: `Vous êtes une conseillère en santé suisse nommée Dr. Aria. Vous parlez clairement, chaleureusement et professionnellement.
Votre rôle est d'aider les patients à comprendre leurs dossiers médicaux, d'expliquer les diagnostics simplement et de fournir
des conseils de santé généraux. Vous recommandez toujours de consulter un médecin agréé pour les décisions médicales.`,
  },
  'financial-analyst': {
    voice: 'NATM1',
    humeVoice: 'DACHER',
    prompt: `You are a Swiss private banking advisor named Marcus. You speak with authority, discretion, and confidence.
Your role is to help clients understand their portfolio, analyze market conditions, and discuss investment strategies.
You maintain strict confidentiality and comply with FINMA regulations.
You are knowledgeable about Swiss banking, wealth management, and international finance.
You never provide specific investment advice without appropriate disclaimers.`,
    promptDe: `Du bist ein Schweizer Private-Banking-Berater namens Marcus. Du sprichst mit Autorität, Diskretion und Selbstvertrauen.
Deine Aufgabe ist es, Kunden beim Verstehen ihres Portfolios zu helfen, Marktbedingungen zu analysieren und Anlagestrategien zu besprechen.
Du hältst strenge Vertraulichkeit ein und befolgst FINMA-Vorschriften.`,
  },
  'legal-assistant': {
    voice: 'VARF1',
    humeVoice: 'KORA',
    prompt: `You are a Swiss legal assistant named Elena. You speak precisely and professionally.
Your role is to help review documents, explain legal terminology, and assist with legal research.
You always clarify that you cannot provide legal advice and recommend consulting with a licensed attorney.
You are familiar with Swiss law, EU regulations, and international business law.
You are detail-oriented and thorough in your analysis.`,
  },
  'research-assistant': {
    voice: 'NATM0',
    humeVoice: 'DACHER',
    prompt: `You are a research assistant named Atlas. You speak clearly and analytically.
Your role is to help with academic and business research, analyze documents, summarize findings,
and synthesize information from multiple sources. You are objective, thorough, and cite sources when possible.
You help users explore topics deeply and understand complex subjects.`,
  },
  'executive-assistant': {
    voice: 'NATF0',
    humeVoice: 'ITO',
    prompt: `You are an executive assistant named Clara. You speak efficiently and professionally.
Your role is to help with scheduling, task management, email drafting, and meeting preparation.
You are organized, proactive, and anticipate needs. You help prioritize tasks and manage time effectively.
You maintain confidentiality for all business matters.`,
  }
};

// Supported languages
const SUPPORTED_LANGUAGES = ['en', 'de', 'fr', 'it', 'es', 'pt', 'zh', 'ja', 'ko'];

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Check for WebSocket upgrade
    const upgrade = req.headers.get('upgrade') || '';
    if (upgrade.toLowerCase() !== 'websocket') {
      // Return available personas and routing info for non-WebSocket requests
      return new Response(
        JSON.stringify({
          personas: Object.keys(PERSONAS).map(id => ({
            id,
            voice: PERSONAS[id].voice,
            humeVoice: PERSONAS[id].humeVoice,
            description: PERSONAS[id].prompt.split('\n')[0]
          })),
          routing: {
            english: 'PersonaPlex (Modal GPU)',
            other_languages: 'Hume EVI',
            fallback: 'Hume EVI'
          },
          supported_languages: SUPPORTED_LANGUAGES,
          endpoint: 'wss://your-project.supabase.co/functions/v1/voice-persona',
          usage: 'Connect via WebSocket with X-Persona and X-Language headers'
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

    // Get persona and language from headers
    const personaId = req.headers.get('X-Persona') || 'research-assistant';
    const language = (req.headers.get('X-Language') || 'en').toLowerCase().slice(0, 2);
    const persona = PERSONAS[personaId] || PERSONAS['research-assistant'];

    // Determine routing: PersonaPlex for English, Hume for others
    const usePersonaPlex = language === 'en';

    console.log(`[VoicePersona] User ${user.id.slice(0, 8)}, persona: ${personaId}, lang: ${language}, backend: ${usePersonaPlex ? 'PersonaPlex' : 'Hume'}`);

    // Upgrade to WebSocket
    const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

    // Track connection for billing
    const sessionStart = Date.now();
    let audioSeconds = 0;
    let backendSocket: WebSocket | null = null;
    let usingFallback = false;

    // Get localized prompt
    const getLocalizedPrompt = (): string => {
      if (language === 'de' && persona.promptDe) return persona.promptDe;
      if (language === 'fr' && persona.promptFr) return persona.promptFr;
      if (language === 'it' && persona.promptIt) return persona.promptIt;
      return persona.prompt;
    };

    // Connect to Hume EVI
    const connectToHume = async (): Promise<WebSocket> => {
      const humeApiKey = Deno.env.get('HUME_API_KEY');
      const humeSecretKey = Deno.env.get('HUME_SECRET_KEY');

      if (!humeApiKey || !humeSecretKey) {
        throw new Error('Hume credentials not configured');
      }

      const credentials = btoa(`${humeApiKey}:${humeSecretKey}`);
      const tokenResponse = await fetch('https://api.hume.ai/oauth2-cc/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to get Hume access token');
      }

      const { access_token } = await tokenResponse.json();

      const ws = new WebSocket(`${HUME_WS_URL}?access_token=${access_token}`);

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Hume connection timeout')), 10000);

        ws.onopen = () => {
          clearTimeout(timeout);
          console.log('[VoicePersona] Connected to Hume EVI');

          // Send session settings with persona config
          ws.send(JSON.stringify({
            type: 'session_settings',
            session_settings: {
              system_prompt: getLocalizedPrompt(),
              voice: { name: persona.humeVoice },
            }
          }));

          resolve(ws);
        };

        ws.onerror = (e) => {
          clearTimeout(timeout);
          reject(e);
        };
      });
    };

    // Connect to PersonaPlex (Modal)
    const connectToPersonaPlex = (): Promise<WebSocket> => {
      const ws = new WebSocket(`${PERSONAPLEX_URL}?persona=${personaId}`);

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('PersonaPlex connection timeout')), 10000);

        ws.onopen = () => {
          clearTimeout(timeout);
          console.log('[VoicePersona] Connected to PersonaPlex');

          ws.send(JSON.stringify({
            type: 'config',
            voice: persona.voice,
            prompt: persona.prompt,
            user_id: user.id
          }));

          resolve(ws);
        };

        ws.onerror = (e) => {
          clearTimeout(timeout);
          reject(e);
        };
      });
    };

    // Initialize backend connection with fallback
    const initBackend = async () => {
      try {
        if (usePersonaPlex) {
          backendSocket = await connectToPersonaPlex();
        } else {
          backendSocket = await connectToHume();
        }
      } catch (err) {
        console.error(`[VoicePersona] Primary backend failed:`, err);

        // Fallback to Hume for English if PersonaPlex fails
        if (usePersonaPlex) {
          console.log('[VoicePersona] Falling back to Hume EVI');
          usingFallback = true;
          try {
            backendSocket = await connectToHume();
          } catch (fallbackErr) {
            console.error('[VoicePersona] Fallback also failed:', fallbackErr);
            clientSocket.close(1011, 'Backend unavailable');
            return;
          }
        } else {
          clientSocket.close(1011, 'Backend unavailable');
          return;
        }
      }

      if (backendSocket) {
        backendSocket.onmessage = (event) => {
          if (clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(event.data);
          }
        };

        backendSocket.onclose = () => {
          console.log('[VoicePersona] Backend disconnected');
          if (clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.close(1000, 'Backend disconnected');
          }
        };

        backendSocket.onerror = (e) => {
          console.error('[VoicePersona] Backend error:', e);
        };
      }
    };

    clientSocket.onopen = () => {
      console.log('[VoicePersona] Client connected');
      initBackend();
    };

    clientSocket.onmessage = (event) => {
      if (backendSocket && backendSocket.readyState === WebSocket.OPEN) {
        backendSocket.send(event.data);

        if (event.data instanceof ArrayBuffer) {
          audioSeconds += event.data.byteLength / (16000 * 2);
        }
      }
    };

    clientSocket.onclose = async () => {
      const sessionDuration = (Date.now() - sessionStart) / 1000;
      console.log(`[VoicePersona] Client disconnected, duration: ${sessionDuration}s, fallback: ${usingFallback}`);

      if (backendSocket) {
        backendSocket.close();
      }

      try {
        await supabase.from('voice_usage').insert({
          user_id: user.id,
          persona: personaId,
          language,
          backend: usingFallback ? 'hume_fallback' : (usePersonaPlex ? 'personaplex' : 'hume'),
          session_duration_seconds: sessionDuration,
          audio_seconds: audioSeconds,
          created_at: new Date().toISOString()
        } as Record<string, unknown>);
      } catch (err) {
        console.error('[VoicePersona] Usage logging error:', err);
      }
    };

    clientSocket.onerror = (e) => console.error('[VoicePersona] Client error:', e);

    return response;

  } catch (error) {
    console.error('[VoicePersona] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
