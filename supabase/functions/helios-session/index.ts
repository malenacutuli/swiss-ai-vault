/**
 * HELIOS Session Edge Function
 * Handles session creation, messaging, and orchestration
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-language',
};

// Models
const MODELS = {
  orchestration: 'claude-sonnet-4-5-20250929',
  clinical: 'claude-opus-4-5-20251101',
  fast: 'claude-haiku-4-5-20251001',
};

// Greetings by language
const GREETINGS: Record<string, string> = {
  en: "Hello! I'm your health assistant. I'll help gather information about your symptoms to connect you with the right care. This is not a substitute for professional medical advice. What brings you in today?",
  es: "¡Hola! Soy tu asistente de salud. Te ayudaré a recopilar información sobre tus síntomas para conectarte con la atención adecuada. Esto no sustituye el consejo médico profesional. ¿Qué te trae hoy?",
  fr: "Bonjour! Je suis votre assistant de santé. Je vais vous aider à recueillir des informations sur vos symptômes pour vous orienter vers les soins appropriés. Ceci ne remplace pas les conseils médicaux professionnels. Qu'est-ce qui vous amène aujourd'hui?",
};

// System prompts by language (abbreviated - full versions in src/i18n)
const SYSTEM_PROMPTS: Record<string, string> = {
  en: `You are a clinical triage AI assistant for HELIOS. You are NOT a doctor.
NEVER diagnose. ALWAYS acknowledge uncertainty. ALWAYS recommend professional evaluation for concerning symptoms.
Immediate escalation triggers: chest pain with risk factors, stroke symptoms, severe breathing difficulty, suicidal ideation, infant fever.
For emergencies, tell patient to call 911 immediately.`,

  es: `Eres un asistente de IA de triaje clínico para HELIOS. NO eres médico.
NUNCA diagnostiques. SIEMPRE reconoce la incertidumbre. SIEMPRE recomienda evaluación profesional para síntomas preocupantes.
Disparadores de escalación inmediata: dolor torácico con factores de riesgo, síntomas de derrame, dificultad respiratoria severa, ideación suicida, fiebre en lactante.
Para emergencias, dile al paciente que llame al 911 inmediatamente.`,

  fr: `Vous êtes un assistant IA de triage clinique pour HELIOS. Vous n'êtes PAS médecin.
NE JAMAIS diagnostiquer. TOUJOURS reconnaître l'incertitude. TOUJOURS recommander une évaluation professionnelle pour les symptômes préoccupants.
Déclencheurs d'escalade immédiate: douleur thoracique avec facteurs de risque, symptômes d'AVC, difficulté respiratoire sévère, idéation suicidaire, fièvre du nourrisson.
Pour les urgences, dites au patient d'appeler le 15 immédiatement.`,
};

// Red flag keywords for deterministic checking
const RED_FLAG_KEYWORDS = {
  cardiac: ['chest pain', 'dolor de pecho', 'douleur thoracique', 'radiating', 'irradia', 'irradie'],
  stroke: ['facial droop', 'arm weakness', 'speech difficulty', 'caída facial', 'debilidad', 'affaissement'],
  suicide: ['kill myself', 'want to die', 'suicide', 'matarme', 'quiero morir', 'me tuer'],
  infant_fever: ['baby', 'infant', 'bebé', 'lactante', 'nourrisson', 'fever', 'fiebre', 'fièvre'],
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const anthropic = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
    });

    const body = await req.json();
    const { action, session_id, message, language = 'en' } = body;

    // Validate language
    if (!['en', 'es', 'fr'].includes(language)) {
      throw new Error('Unsupported language. Supported: en, es, fr');
    }

    switch (action) {
      // ========================================
      // CREATE SESSION
      // ========================================
      case 'create': {
        const authHeader = req.headers.get('Authorization');
        const token = authHeader?.replace('Bearer ', '');

        let userId: string | null = null;
        if (token) {
          const { data: { user } } = await supabase.auth.getUser(token);
          userId = user?.id || null;
        }

        // Create session
        const { data: session, error } = await supabase
          .from('helios.case_sessions')
          .insert({
            patient_id: userId,
            language,
            current_phase: 'intake',
            messages: [{
              message_id: crypto.randomUUID(),
              role: 'assistant',
              content: GREETINGS[language],
              language,
              timestamp: new Date().toISOString(),
            }],
            metadata: {
              client_type: 'web',
              started_at: new Date().toISOString(),
            },
          })
          .select()
          .single();

        if (error) throw error;

        // Audit log
        await supabase.from('helios.audit_log').insert({
          session_id: session.session_id,
          event_type: 'session_started',
          actor_type: 'system',
          actor_id: 'helios-session',
          event_payload: { language, patient_id: userId },
          language,
          event_hash: crypto.randomUUID(),
        });

        return new Response(JSON.stringify({
          session_id: session.session_id,
          phase: 'intake',
          message: GREETINGS[language],
          language,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ========================================
      // PROCESS MESSAGE
      // ========================================
      case 'message': {
        if (!session_id || !message) {
          throw new Error('session_id and message are required');
        }

        // Load session
        const { data: session, error: loadError } = await supabase
          .from('helios.case_sessions')
          .select('*')
          .eq('session_id', session_id)
          .single();

        if (loadError || !session) {
          throw new Error('Session not found');
        }

        // Check for red flags (deterministic)
        const redFlags = checkRedFlags(message, session.language);

        // If critical red flag, escalate immediately
        if (redFlags.length > 0 && redFlags.some((f: { severity: string }) => f.severity === 'critical')) {
          const emergencyResponse = getEmergencyResponse(redFlags[0], session.language);

          // Update session with escalation
          const updatedMessages = [
            ...session.messages,
            {
              message_id: crypto.randomUUID(),
              role: 'user',
              content: message,
              language: session.language,
              timestamp: new Date().toISOString(),
            },
            {
              message_id: crypto.randomUUID(),
              role: 'assistant',
              content: emergencyResponse,
              language: session.language,
              timestamp: new Date().toISOString(),
            },
          ];

          await supabase
            .from('helios.case_sessions')
            .update({
              messages: updatedMessages,
              red_flags: [...session.red_flags, ...redFlags],
              escalation_triggered: true,
              escalation_reason: redFlags[0].description,
              current_phase: 'escalated',
            })
            .eq('session_id', session_id);

          // Audit
          await supabase.from('helios.audit_log').insert({
            session_id,
            event_type: 'escalation_triggered',
            actor_type: 'safety_engine',
            actor_id: 'deterministic_rules',
            event_payload: { red_flags: redFlags, message },
            language: session.language,
            event_hash: crypto.randomUUID(),
          });

          return new Response(JSON.stringify({
            session_id,
            phase: 'escalated',
            message: emergencyResponse,
            language: session.language,
            red_flags: redFlags,
            escalated: true,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Normal processing with Claude
        const systemPrompt = SYSTEM_PROMPTS[session.language];

        const response = await anthropic.messages.create({
          model: MODELS.orchestration,
          max_tokens: 2048,
          system: systemPrompt,
          messages: [
            ...formatMessages(session.messages),
            { role: 'user', content: message },
          ],
        });

        const assistantContent = response.content[0].type === 'text'
          ? response.content[0].text
          : '';

        // Update session
        const updatedMessages = [
          ...session.messages,
          {
            message_id: crypto.randomUUID(),
            role: 'user',
            content: message,
            language: session.language,
            timestamp: new Date().toISOString(),
          },
          {
            message_id: crypto.randomUUID(),
            role: 'assistant',
            content: assistantContent,
            language: session.language,
            timestamp: new Date().toISOString(),
          },
        ];

        await supabase
          .from('helios.case_sessions')
          .update({
            messages: updatedMessages,
            red_flags: [...session.red_flags, ...redFlags],
          })
          .eq('session_id', session_id);

        // Audit
        await supabase.from('helios.audit_log').insert({
          session_id,
          event_type: 'message_sent',
          actor_type: 'agent',
          actor_id: 'orchestrator',
          event_payload: {
            model: MODELS.orchestration,
            input_tokens: response.usage?.input_tokens,
            output_tokens: response.usage?.output_tokens,
          },
          language: session.language,
          event_hash: crypto.randomUUID(),
        });

        return new Response(JSON.stringify({
          session_id,
          phase: session.current_phase,
          message: assistantContent,
          language: session.language,
          red_flags: redFlags.length > 0 ? redFlags : undefined,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ========================================
      // GET SESSION
      // ========================================
      case 'get': {
        if (!session_id) {
          throw new Error('session_id is required');
        }

        const { data: session, error } = await supabase
          .from('helios.case_sessions')
          .select('*')
          .eq('session_id', session_id)
          .single();

        if (error || !session) {
          throw new Error('Session not found');
        }

        return new Response(JSON.stringify(session), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('HELIOS Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ========================================
// HELPER FUNCTIONS
// ========================================

interface MessageParam {
  role: 'user' | 'assistant';
  content: string;
}

interface SessionMessage {
  role: string;
  content: string;
}

function formatMessages(messages: SessionMessage[]): MessageParam[] {
  return messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
}

interface RedFlag {
  flag_id: string;
  rule_id: string;
  flag_type: string;
  description: string;
  severity: string;
  escalation_level: string;
  detected_at: string;
}

function checkRedFlags(message: string, language: string): RedFlag[] {
  const flags: RedFlag[] = [];
  const lowerMessage = message.toLowerCase();

  // Check suicide keywords (highest priority)
  if (RED_FLAG_KEYWORDS.suicide.some(k => lowerMessage.includes(k))) {
    flags.push({
      flag_id: crypto.randomUUID(),
      rule_id: 'psych_001',
      flag_type: 'psychiatric',
      description: language === 'es' ? 'Ideación suicida detectada' :
                   language === 'fr' ? 'Idéation suicidaire détectée' :
                   'Suicidal ideation detected',
      severity: 'critical',
      escalation_level: 'emergency',
      detected_at: new Date().toISOString(),
    });
  }

  // Check cardiac keywords
  if (RED_FLAG_KEYWORDS.cardiac.some(k => lowerMessage.includes(k))) {
    flags.push({
      flag_id: crypto.randomUUID(),
      rule_id: 'cardiac_001',
      flag_type: 'cardiac',
      description: language === 'es' ? 'Síntomas cardíacos detectados' :
                   language === 'fr' ? 'Symptômes cardiaques détectés' :
                   'Cardiac symptoms detected',
      severity: 'critical',
      escalation_level: 'emergency',
      detected_at: new Date().toISOString(),
    });
  }

  // Check stroke keywords
  if (RED_FLAG_KEYWORDS.stroke.some(k => lowerMessage.includes(k))) {
    flags.push({
      flag_id: crypto.randomUUID(),
      rule_id: 'neuro_001',
      flag_type: 'neuro',
      description: language === 'es' ? 'Síntomas de derrame detectados' :
                   language === 'fr' ? 'Symptômes d\'AVC détectés' :
                   'Stroke symptoms detected',
      severity: 'critical',
      escalation_level: 'emergency',
      detected_at: new Date().toISOString(),
    });
  }

  return flags;
}

function getEmergencyResponse(flag: RedFlag, language: string): string {
  const responses: Record<string, Record<string, string>> = {
    psych_001: {
      en: "I'm very concerned about what you're sharing. Your life matters, and help is available right now. Please call 988 (Suicide & Crisis Lifeline) immediately to speak with someone who can help. If you're in immediate danger, call 911.",
      es: "Me preocupa mucho lo que estás compartiendo. Tu vida importa y hay ayuda disponible ahora mismo. Por favor llama al 024 (Línea de Atención a la Conducta Suicida) inmediatamente. Si estás en peligro inmediato, llama al 911.",
      fr: "Je suis très préoccupé par ce que vous partagez. Votre vie compte et de l'aide est disponible maintenant. Veuillez appeler le 3114 (Numéro national de prévention du suicide) immédiatement. Si vous êtes en danger immédiat, appelez le 15.",
    },
    cardiac_001: {
      en: "⚠️ EMERGENCY: Based on what you've described, you may be experiencing a serious cardiac event. Please call 911 immediately. Do not drive yourself. While waiting, sit upright and stay calm.",
      es: "⚠️ EMERGENCIA: Según lo que describes, podrías estar experimentando un evento cardíaco grave. Llama al 911 inmediatamente. No conduzcas tú mismo. Mientras esperas, siéntate erguido y mantén la calma.",
      fr: "⚠️ URGENCE: D'après ce que vous décrivez, vous pourriez avoir un événement cardiaque grave. Appelez le 15 immédiatement. Ne conduisez pas vous-même. En attendant, restez assis et gardez votre calme.",
    },
    neuro_001: {
      en: "⚠️ EMERGENCY: The symptoms you're describing could indicate a stroke. Time is critical. Call 911 immediately. Note the time symptoms started.",
      es: "⚠️ EMERGENCIA: Los síntomas que describes podrían indicar un derrame cerebral. El tiempo es crítico. Llama al 911 inmediatamente. Anota la hora de inicio.",
      fr: "⚠️ URGENCE: Les symptômes que vous décrivez pourraient indiquer un AVC. Le temps est critique. Appelez le 15 immédiatement. Notez l'heure de début.",
    },
  };

  return responses[flag.rule_id]?.[language] || responses[flag.rule_id]?.en ||
    "⚠️ EMERGENCY: Please call emergency services immediately.";
}
