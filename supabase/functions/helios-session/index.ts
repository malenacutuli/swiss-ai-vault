// supabase/functions/helios-session/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.24.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Clinical triage system prompt
const HELIOS_SYSTEM_PROMPT = `You are HELIOS, an AI health assistant that helps gather information about symptoms to connect users with the right care.

CRITICAL RULES:
1. You are NOT a doctor and cannot diagnose conditions
2. You gather symptoms and medical history through empathetic conversation
3. You ALWAYS recommend discussing with a healthcare provider
4. For emergencies (chest pain, difficulty breathing, stroke symptoms, severe bleeding), immediately direct to call 911

Your conversation flow:
1. Acknowledge their concern with empathy
2. Ask clarifying questions about symptoms (onset, duration, severity 1-10, location, character)
3. Ask about relevant medical history, medications, allergies
4. Provide general health information (not diagnosis)
5. Recommend appropriate next steps (doctor visit, urgent care, or emergency)

Always be warm, professional, and reassuring. Use simple language.`;

// Red flag keywords that require immediate escalation
const RED_FLAGS = [
  // Cardiac
  { pattern: /chest\s*pain|heart\s*attack|crushing.*chest/i, severity: 'critical', action: 'Call 911 immediately' },
  { pattern: /arm.*pain.*chest|jaw.*pain.*chest/i, severity: 'critical', action: 'Call 911 immediately' },

  // Neurological
  { pattern: /stroke|face.*droop|slurred\s*speech|sudden.*weakness/i, severity: 'critical', action: 'Call 911 immediately' },
  { pattern: /worst.*headache|thunderclap/i, severity: 'critical', action: 'Call 911 immediately' },

  // Respiratory
  { pattern: /can'?t\s*breathe|choking|severe.*breathing/i, severity: 'critical', action: 'Call 911 immediately' },

  // Psychiatric
  { pattern: /suicid|kill\s*myself|end.*life|want.*die/i, severity: 'critical', action: 'Call 988 (Suicide Hotline)' },
  { pattern: /harm\s*myself|self.?harm/i, severity: 'high', action: 'Please reach out to 988 or a mental health professional' },

  // Pediatric
  { pattern: /baby.*fever|infant.*not.*breathing|newborn.*blue/i, severity: 'critical', action: 'Call 911 immediately' },

  // Trauma
  { pattern: /severe.*bleeding|won'?t.*stop.*bleeding|deep.*cut/i, severity: 'critical', action: 'Call 911 immediately' },
  { pattern: /head.*injury.*unconscious|loss.*consciousness/i, severity: 'critical', action: 'Call 911 immediately' },
];

function checkRedFlags(message: string): { detected: boolean; flags: any[] } {
  const detectedFlags: any[] = [];

  for (const flag of RED_FLAGS) {
    if (flag.pattern.test(message)) {
      detectedFlags.push({
        severity: flag.severity,
        action: flag.action,
        detected_at: new Date().toISOString(),
      });
    }
  }

  return {
    detected: detectedFlags.length > 0,
    flags: detectedFlags,
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const { action, session_id, message, language = 'en', patient_info } = await req.json();

    switch (action) {
      // =====================================
      // CREATE NEW SESSION
      // =====================================
      case "create": {
        const sessionId = crypto.randomUUID();

        const initialState = {
          session_id: sessionId,
          language,
          current_phase: 'intake',
          messages: [],
          symptom_entities: [],
          medical_history: {},
          medications: [],
          allergies: [],
          red_flags: [],
          triage_level: null,
          disposition: null,
          patient_info: patient_info || {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Store in database (optional - can also be client-side only for privacy)
        const { error } = await supabase
          .from('helios_sessions')
          .insert(initialState);

        if (error) {
          console.error('Session creation error:', error);
          // Continue anyway - session can work without DB storage
        }

        // Generate welcome message
        const welcomeMessages: Record<string, string> = {
          en: "Hello! I'm your AI health assistant. I'll help gather information about your symptoms to connect you with the right care. This is not a substitute for professional medical advice. What brings you in today?",
          es: "¡Hola! Soy tu asistente de salud con IA. Te ayudaré a recopilar información sobre tus síntomas para conectarte con la atención adecuada. Esto no sustituye el consejo médico profesional. ¿Qué te trae hoy?",
          fr: "Bonjour ! Je suis votre assistant santé IA. Je vais vous aider à rassembler des informations sur vos symptômes pour vous orienter vers les soins appropriés. Ceci ne remplace pas un avis médical professionnel. Qu'est-ce qui vous amène aujourd'hui ?"
        };

        return new Response(JSON.stringify({
          success: true,
          session_id: sessionId,
          phase: 'intake',
          message: welcomeMessages[language] || welcomeMessages.en,
          language,
          caseState: initialState,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // =====================================
      // SEND MESSAGE
      // =====================================
      case "message": {
        if (!session_id || !message) {
          throw new Error("session_id and message are required");
        }

        // Check for red flags FIRST
        const redFlagCheck = checkRedFlags(message);

        if (redFlagCheck.detected) {
          const criticalFlags = redFlagCheck.flags.filter(f => f.severity === 'critical');

          if (criticalFlags.length > 0) {
            // Immediate escalation response
            const escalationResponse = {
              en: `🚨 **This sounds like a medical emergency.** ${criticalFlags[0].action}. Do not wait - get help immediately. If you're unable to call, have someone nearby call for you.`,
              es: `🚨 **Esto suena como una emergencia médica.** ${criticalFlags[0].action}. No espere - obtenga ayuda inmediatamente.`,
              fr: `🚨 **Cela ressemble à une urgence médicale.** ${criticalFlags[0].action}. N'attendez pas - obtenez de l'aide immédiatement.`,
            };

            return new Response(JSON.stringify({
              success: true,
              session_id,
              phase: 'escalated',
              message: escalationResponse[language] || escalationResponse.en,
              red_flags: redFlagCheck.flags,
              escalated: true,
              caseState: {
                session_id,
                current_phase: 'escalated',
                red_flags: redFlagCheck.flags,
              },
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        // Get existing session if available
        let sessionHistory: any[] = [];
        const { data: existingSession } = await supabase
          .from('helios_sessions')
          .select('*')
          .eq('session_id', session_id)
          .single();

        if (existingSession) {
          sessionHistory = existingSession.messages || [];
        }

        // Build messages for Claude
        const claudeMessages = [
          ...sessionHistory.map((m: any) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
          { role: 'user' as const, content: message },
        ];

        // Call Claude
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514', // Using Sonnet for healthcare
          max_tokens: 1024,
          system: HELIOS_SYSTEM_PROMPT,
          messages: claudeMessages,
        });

        const assistantMessage = response.content[0].type === 'text'
          ? response.content[0].text
          : '';

        // Determine phase based on conversation
        let currentPhase = 'history_taking';
        if (sessionHistory.length === 0) {
          currentPhase = 'chief_complaint';
        } else if (sessionHistory.length > 6) {
          currentPhase = 'assessment';
        }

        // Update session in database
        const updatedMessages = [
          ...sessionHistory,
          { role: 'user', content: message, timestamp: new Date().toISOString() },
          { role: 'assistant', content: assistantMessage, timestamp: new Date().toISOString() },
        ];

        await supabase
          .from('helios_sessions')
          .upsert({
            session_id,
            messages: updatedMessages,
            current_phase: currentPhase,
            red_flags: redFlagCheck.flags,
            updated_at: new Date().toISOString(),
          });

        return new Response(JSON.stringify({
          success: true,
          session_id,
          phase: currentPhase,
          message: assistantMessage,
          language,
          red_flags: redFlagCheck.flags.length > 0 ? redFlagCheck.flags : undefined,
          caseState: {
            session_id,
            current_phase: currentPhase,
            messages: updatedMessages,
            red_flags: redFlagCheck.flags,
          },
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // =====================================
      // GET SESSION
      // =====================================
      case "get": {
        if (!session_id) {
          throw new Error("session_id is required");
        }

        const { data: session, error } = await supabase
          .from('helios_sessions')
          .select('*')
          .eq('session_id', session_id)
          .single();

        if (error || !session) {
          throw new Error("Session not found");
        }

        return new Response(JSON.stringify({
          success: true,
          session_id,
          caseState: session,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // =====================================
      // SUBMIT INTAKE (age/sex)
      // =====================================
      case "intake": {
        if (!session_id || !patient_info) {
          throw new Error("session_id and patient_info are required");
        }

        await supabase
          .from('helios_sessions')
          .update({
            patient_info,
            current_phase: 'history_taking',
            updated_at: new Date().toISOString(),
          })
          .eq('session_id', session_id);

        // Generate acknowledgment
        const ackMessages: Record<string, string> = {
          en: `Thank you for sharing those details. I want to make sure I give you the most accurate advice and support possible. Now, let's talk about what's bringing you in today. Can you describe your main concern?`,
          es: `Gracias por compartir esos detalles. Quiero asegurarme de darte los consejos y el apoyo más precisos posibles. Ahora, hablemos de lo que te trae hoy. ¿Puedes describir tu preocupación principal?`,
          fr: `Merci d'avoir partagé ces détails. Je veux m'assurer de vous donner les conseils et le soutien les plus précis possibles. Maintenant, parlons de ce qui vous amène aujourd'hui. Pouvez-vous décrire votre préoccupation principale ?`,
        };

        return new Response(JSON.stringify({
          success: true,
          session_id,
          phase: 'history_taking',
          message: ackMessages[language] || ackMessages.en,
          caseState: {
            session_id,
            current_phase: 'history_taking',
            patient_info,
          },
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error("HELIOS session error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
