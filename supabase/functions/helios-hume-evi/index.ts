import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const HUME_API_KEY = Deno.env.get('HUME_API_KEY');
const HUME_SECRET_KEY = Deno.env.get('HUME_SECRET_KEY');

// HELIOS specialty agent prompts
const SPECIALTY_PROMPTS: Record<string, string> = {
  'primary-care': 'Focus on general health assessment, lifestyle factors, and preventive care.',
  'dermatology': 'Focus on skin conditions: appearance, location, duration, itching, spreading.',
  'womens-health': 'Focus on gynecological and reproductive health with sensitivity.',
  'mental-health': 'Be extra empathetic. Screen for depression, anxiety. Always provide crisis resources (988).',
  'pediatrics': 'Assume parent is describing child symptoms. Ask about age, development, vaccinations.',
  'cardiology': 'Be vigilant for emergency symptoms. Use PQRST for chest pain. Screen cardiac risk factors.',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse body to get action
    const body = await req.json();
    const action = body.action;
    
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (action === 'get_access_token') {
      // Get voice access token for WebSocket connection using OAuth
      const { session_id, specialty, language } = body;

      if (!HUME_API_KEY || !HUME_SECRET_KEY) {
        console.error('[Voice] API credentials not configured');
        return new Response(
          JSON.stringify({ error: 'Voice service is not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch access token from Hume OAuth API
      const credentials = btoa(`${HUME_API_KEY}:${HUME_SECRET_KEY}`);
      
      const tokenResponse = await fetch('https://api.hume.ai/oauth2-cc/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('[Voice] Token error:', errorText);
        return new Response(
          JSON.stringify({ error: 'Failed to get voice access token' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;
      
      console.log('[Voice] Access token generated for session:', session_id);

      // Build system prompt for the specialty
      const systemPrompt = buildSystemPrompt(specialty, language);

      // Update session with voice enabled status
      if (session_id) {
        await supabaseClient
          .from('helios_sessions')
          .update({
            voice_enabled: true,
            updated_at: new Date().toISOString()
          })
          .eq('session_id', session_id);
      }

      return new Response(
        JSON.stringify({
          accessToken,
          expiresIn: tokenData.expires_in,
          systemPrompt,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'handle_tool_call') {
      // Handle tool calls from Hume EVI
      const { tool_name, parameters, session_id } = body;

      const result = await handleHeliosTool(supabaseClient, tool_name, parameters, session_id);

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'save_transcript') {
      // Save conversation transcript
      const { session_id, transcript, audio_url } = body;

      await supabaseClient
        .from('helios_sessions')
        .update({
          transcript: transcript,
          audio_recording_url: audio_url,
          updated_at: new Date().toISOString()
        })
        .eq('session_id', session_id);

      // Generate SOAP note from transcript
      const soapNote = await generateSOAPFromTranscript(transcript);

      await supabaseClient
        .from('helios_sessions')
        .update({ soap_note: soapNote })
        .eq('session_id', session_id);

      return new Response(
        JSON.stringify({ success: true, soap_note: soapNote }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Voice] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Voice service error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildSystemPrompt(specialty: string, language: string): string {
  const base = `You are HELIOS, an empathetic AI health assistant conducting a voice consultation.

VOICE INTERACTION GUIDELINES:
- Speak naturally and conversationally
- Be warm, patient, and reassuring
- Ask ONE question at a time
- Pause after questions to let the patient respond
- Acknowledge the patient's feelings when they express worry or distress
- Use simple language, avoid medical jargon

INFORMATION GATHERING (OLDCARTS):
- Onset: When did this start?
- Location: Where exactly?
- Duration: Constant or comes and goes?
- Character: What does it feel like?
- Aggravating factors: What makes it worse?
- Relieving factors: What helps?
- Timing: Any pattern?
- Severity: Scale of 1-10?

IMPORTANT:
- You do NOT diagnose conditions
- You gather information to help connect patients with the right care
- For emergency symptoms, immediately recommend calling 911

`;

  const specialtyGuidance = SPECIALTY_PROMPTS[specialty] || SPECIALTY_PROMPTS['primary-care'];

  const languageNote = language !== 'en'
    ? `\nCONDUCT THIS CONSULTATION IN ${language.toUpperCase()}. Respond only in ${language}.`
    : '';

  return base + `\nSPECIALTY FOCUS: ${specialty}\n${specialtyGuidance}${languageNote}`;
}

function getHeliosTools() {
  return [
    {
      name: 'query_medical_knowledge',
      description: 'Search HELIOS medical knowledge base',
      parameters: {
        type: 'object',
        properties: {
          condition: { type: 'string', description: 'Medical condition or symptom to research' },
          context: { type: 'string', description: 'Additional context from conversation' }
        },
        required: ['condition']
      }
    },
    {
      name: 'assess_urgency',
      description: 'Assess the urgency level of the patient condition',
      parameters: {
        type: 'object',
        properties: {
          symptoms: { type: 'array', items: { type: 'string' } },
          red_flags: { type: 'array', items: { type: 'string' } }
        },
        required: ['symptoms']
      }
    },
    {
      name: 'generate_summary',
      description: 'Generate consultation summary when conversation is complete',
      parameters: {
        type: 'object',
        properties: {
          chief_complaint: { type: 'string' },
          history: { type: 'string' },
          recommended_action: { type: 'string', enum: ['self-care', 'schedule-appointment', 'see-doctor-soon', 'urgent-care', 'emergency'] }
        },
        required: ['chief_complaint', 'recommended_action']
      }
    },
    {
      name: 'end_consultation',
      description: 'End the voice consultation and generate final report',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', enum: ['complete', 'emergency-referral', 'patient-request'] }
        },
        required: ['reason']
      }
    }
  ];
}

async function handleHeliosTool(
  supabase: any,
  toolName: string,
  params: Record<string, unknown>,
  sessionId: string
): Promise<Record<string, unknown>> {
  switch (toolName) {
    case 'query_medical_knowledge':
      // Query HELIOS knowledge base
      // This would connect to your medical knowledge base
      return {
        result: `Information about ${params.condition} retrieved from HELIOS knowledge base.`,
        sources: ['HELIOS Medical DB', 'Clinical Guidelines']
      };

    case 'assess_urgency': {
      const redFlags = (params.red_flags as string[]) || [];
      const urgency = redFlags.length > 0 ? 'urgent' : 'routine';

      // Update session with urgency
      await supabase
        .from('helios_sessions')
        .update({
          urgency_level: urgency,
          red_flags: redFlags
        } as any)
        .eq('session_id', sessionId);

      return { urgency, red_flags: redFlags };
    }

    case 'generate_summary':
      // Store summary in session
      await supabase
        .from('helios_sessions')
        .update({
          summary: params.chief_complaint,
          recommended_action: params.recommended_action,
          history_of_present_illness: params.history
        } as any)
        .eq('session_id', sessionId);

      return { success: true };

    case 'end_consultation':
      // Mark session as completed
      await supabase
        .from('helios_sessions')
        .update({
          current_phase: 'completed',
          completed_at: new Date().toISOString(),
          completion_reason: params.reason
        } as any)
        .eq('session_id', sessionId);

      return {
        success: true,
        message: 'Consultation ended. Summary will be generated.'
      };

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

async function generateSOAPFromTranscript(transcript: Array<{ role: string; content: string }>): Promise<Record<string, string>> {
  // Extract SOAP components from transcript
  const subjective: string[] = [];

  for (const entry of transcript) {
    if (entry.role === 'user') {
      subjective.push(entry.content);
    }
  }

  return {
    subjective: subjective.join(' '),
    objective: 'Patient participated in AI-assisted health consultation via voice.',
    assessment: 'See AI consultation summary for symptom analysis.',
    plan: 'Recommend follow-up with healthcare provider for clinical evaluation.'
  };
}
