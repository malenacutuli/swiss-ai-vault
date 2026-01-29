import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.24.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Context window management - keeps first 2 messages (greeting + initial complaint) and recent messages
const MAX_CONTEXT_MESSAGES = 20;

function manageContextWindow(messages: Array<{role: string, content: string}>): Array<{role: string, content: string}> {
  // If under limit, return all
  if (messages.length <= MAX_CONTEXT_MESSAGES) {
    return messages;
  }

  // Keep system message if present
  const systemMessages = messages.filter(m => m.role === 'system');
  const nonSystemMessages = messages.filter(m => m.role !== 'system');

  // Keep first 2 messages (greeting + initial complaint) for context
  const keepFirst = Math.min(2, nonSystemMessages.length);
  const firstMessages = nonSystemMessages.slice(0, keepFirst);

  // Calculate how many recent messages to keep
  const keepLast = MAX_CONTEXT_MESSAGES - keepFirst - systemMessages.length - 1; // -1 for summary
  const lastMessages = nonSystemMessages.slice(-keepLast);

  // Summarize middle messages
  const middleMessages = nonSystemMessages.slice(keepFirst, -keepLast);
  if (middleMessages.length > 0) {
    const summaryContent = middleMessages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join('; ')
      .substring(0, 500);

    const summaryMessage = {
      role: 'system' as const,
      content: `[Earlier in this consultation, the patient mentioned: ${summaryContent}...]`
    };

    return [...systemMessages, ...firstMessages, summaryMessage, ...lastMessages];
  }

  return [...systemMessages, ...firstMessages, ...lastMessages];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const body = await req.json();
    const action = body.action;
    const session_id = body.session_id;
    const message = body.message;
    const patient_info = body.patient_info;
    const specialty = body.specialty || "primary-care";
    const language = body.language || "en";

    // Language instructions
    const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
      "en": "Respond in English.",
      "es": "Responde en español.",
      "fr": "Répondez en français.",
      "de": "Antworten Sie auf Deutsch.",
      "it": "Rispondi in italiano.",
      "pt": "Responda em português.",
      "zh": "请用中文回答。",
      "ja": "日本語で回答してください。",
      "ko": "한국어로 대답해 주세요.",
      "ar": "الرجاء الرد بالعربية.",
    };

    // Base system prompt with clinical guidelines
    const BASE_SYSTEM_PROMPT = `You are HELIOS, an AI health assistant. You help gather information about symptoms to connect patients with the right care. You do NOT diagnose conditions or provide medical advice - you gather information and recommend appropriate care pathways.

IMPORTANT GUIDELINES:
- Be warm, empathetic, and professional
- Ask one or two questions at a time, not overwhelming lists
- Use the OLDCARTS method: Onset, Location, Duration, Character, Aggravating factors, Relieving factors, Timing, Severity
- Always recommend professional medical evaluation for concerning symptoms
- Never provide specific diagnoses or treatment recommendations
- If emergency symptoms are mentioned (chest pain, difficulty breathing, stroke symptoms, severe bleeding), immediately recommend calling 911

EMERGENCY RED FLAGS - Recommend 911 immediately if patient mentions:
- Chest pain with arm/jaw radiation
- Sudden severe headache ("worst headache of life")
- Difficulty breathing or choking
- Signs of stroke (face drooping, arm weakness, speech difficulty)
- Severe bleeding or trauma
- Suicidal thoughts or self-harm intentions
- Infant not breathing or unresponsive`;

    // Specialty-specific guidance
    const SPECIALTY_PROMPTS: Record<string, string> = {
      "primary-care": `You are conducting a general health assessment.
Focus on: overall health status, lifestyle factors, preventive care needs.
Screen for common conditions based on the patient's age and sex.
Ask about: sleep, diet, exercise, stress, medications, recent health changes.`,

      "cardiology": `You are conducting a cardiovascular assessment.
Be VERY vigilant for emergency symptoms requiring immediate care.
Ask about chest pain using PQRST: Provocation, Quality, Radiation, Severity, Timing.
Ask about: shortness of breath, palpitations, swelling, dizziness, exercise tolerance.
Screen for cardiac risk factors: hypertension, diabetes, cholesterol, smoking, family history.
If symptoms suggest acute cardiac event, immediately recommend calling 911.`,

      "dermatology": `You are conducting a dermatological assessment.
Focus on skin, hair, and nail conditions.
Ask about: appearance (color, texture, size), location, duration, itching/pain, spreading.
Ask about: sun exposure history, skincare routine, family history of skin conditions.
Recommend the patient take photos to share with their dermatologist if appropriate.`,

      "mental-health": `You are conducting a mental health assessment.
Be extra empathetic, patient, and non-judgmental.
Screen for depression (mood, interest, sleep, energy), anxiety (worry, physical symptoms), and safety.
Ask about: stress, relationships, work/school, sleep patterns, substance use.
ALWAYS provide crisis resources if the patient mentions self-harm, suicide, or feeling unsafe.
Crisis line: 988 (Suicide & Crisis Lifeline)`,

      "pediatrics": `You are conducting a pediatric assessment.
Assume the parent/caregiver is describing their child's symptoms.
Ask about: child's age, developmental milestones, vaccination status.
Ask about: feeding/eating, sleep patterns, activity level, recent exposures (daycare, sick contacts).
Use age-appropriate recommendations and always recommend professional evaluation for concerning symptoms.`,

      "womens-health": `You are conducting a women's health assessment.
Focus on gynecological and reproductive health concerns.
Ask about: menstrual history, contraception, pregnancy history, menopause symptoms if applicable.
Be sensitive and professional when discussing intimate health topics.
Screen for breast health, cervical health, and pelvic concerns.`,

      "orthopedics": `You are conducting a musculoskeletal assessment.
Focus on bones, joints, muscles, and connective tissue concerns.
Ask about: pain location, onset (sudden vs gradual), mechanism of injury if applicable.
Ask about: range of motion, swelling, numbness/tingling, weight-bearing ability.
Screen for: fracture signs, nerve involvement, and functional limitations.`,
    };

    if (action === "create") {
      const sessionId = crypto.randomUUID();
      await supabase.from("helios_sessions").insert({
        session_id: sessionId,
        current_phase: "intake",
        specialty: specialty,
        messages: [],
        patient_info: patient_info || {},
      });

      // Specialty-specific greeting
      const greetings: Record<string, string> = {
        "primary-care": "Hello! I'm your HELIOS health assistant. What brings you in today?",
        "cardiology": "Hello! I'm HELIOS, here to help with heart-related concerns. What symptoms are you experiencing?",
        "dermatology": "Hello! I'm HELIOS, ready to help with skin-related concerns. Can you describe what you're seeing on your skin?",
        "mental-health": "Hello, I'm HELIOS. I'm here to listen and help. How are you feeling today?",
        "pediatrics": "Hello! I'm HELIOS, here to help with your child's health. What concerns do you have?",
        "womens-health": "Hello! I'm HELIOS, ready to help with your health questions. What would you like to discuss?",
        "orthopedics": "Hello! I'm HELIOS, here to help with bone and joint concerns. Where are you experiencing pain or discomfort?",
      };

      return new Response(JSON.stringify({
        success: true,
        session_id: sessionId,
        phase: "intake",
        specialty: specialty,
        message: greetings[specialty] || greetings["primary-care"],
        caseState: { session_id: sessionId, specialty: specialty },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "message") {
      const lowerMsg = message.toLowerCase();

      if (lowerMsg.includes("chest pain") || lowerMsg.includes("stroke")) {
        return new Response(JSON.stringify({
          success: true,
          session_id: session_id,
          phase: "escalated",
          message: "EMERGENCY: Call 911 now.",
          escalated: true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: sess } = await supabase
        .from("helios_sessions")
        .select("messages, patient_info, specialty, language")
        .eq("session_id", session_id)
        .single();

      const history = sess?.messages || [];
      const patientInfo = sess?.patient_info || {};
      const sessionSpecialty = sess?.specialty || "primary-care";
      const sessionLanguage = language || sess?.language || "en";

      // Build message history and add current message
      let contextMessages = history.map((m: any) => ({ role: m.role, content: m.content }));
      contextMessages.push({ role: "user", content: message });

      // Apply context window management to prevent token overflow
      const managedMessages = manageContextWindow(contextMessages);

      // Build system prompt with base guidelines, specialty, language, and patient context
      const specialtyGuidance = SPECIALTY_PROMPTS[sessionSpecialty] || SPECIALTY_PROMPTS["primary-care"];
      let systemPrompt = `${BASE_SYSTEM_PROMPT}\n\n## SPECIALTY FOCUS: ${sessionSpecialty.toUpperCase()}\n${specialtyGuidance}`;
      systemPrompt += "\n\n" + (LANGUAGE_INSTRUCTIONS[sessionLanguage] || LANGUAGE_INSTRUCTIONS["en"]);
      if (patientInfo.age || patientInfo.sex) {
        systemPrompt += " Patient info: ";
        if (patientInfo.age) systemPrompt += "Age " + patientInfo.age + ". ";
        if (patientInfo.sex) systemPrompt += "Sex: " + patientInfo.sex + ". ";
      }

      // Extract any summary from managed messages and add to system prompt
      const summaryMsg = managedMessages.find(m => m.role === 'system');
      if (summaryMsg) {
        systemPrompt += " " + summaryMsg.content;
      }

      // Filter to only user/assistant messages for API
      const apiMessages = managedMessages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const resp = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: apiMessages,
      });

      const reply = resp.content[0].type === "text" ? resp.content[0].text : "";

      const now = new Date().toISOString();
      const newMsgs = [
        ...history,
        { role: "user", content: message, message_id: crypto.randomUUID(), timestamp: now },
        { role: "assistant", content: reply, message_id: crypto.randomUUID(), timestamp: now },
      ];

      await supabase.from("helios_sessions").upsert({
        session_id: session_id,
        messages: newMsgs,
      });

      return new Response(JSON.stringify({
        success: true,
        session_id: session_id,
        message: reply,
        caseState: { session_id: session_id, messages: newMsgs },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "intake") {
      await supabase
        .from("helios_sessions")
        .update({ patient_info: patient_info })
        .eq("session_id", session_id);

      return new Response(JSON.stringify({
        success: true,
        session_id: session_id,
        message: "Thanks. What is your concern?",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "complete_session") {
      if (!session_id) {
        return new Response(JSON.stringify({
          success: false,
          error: "session_id is required",
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get the session first to generate summary
      const { data: session } = await supabase
        .from("helios_sessions")
        .select("messages, specialty, patient_info")
        .eq("session_id", session_id)
        .single();

      // Generate a simple summary from user messages
      const userMessages = (session?.messages || [])
        .filter((m: any) => m.role === "user")
        .map((m: any) => m.content)
        .join(". ")
        .substring(0, 500);

      const summary = userMessages || "No symptoms recorded";
      const completedAt = new Date().toISOString();

      const { error: updateError } = await supabase
        .from("helios_sessions")
        .update({
          current_phase: "completed",
          completed_at: completedAt,
          updated_at: completedAt,
          summary: summary,
        })
        .eq("session_id", session_id);

      if (updateError) {
        return new Response(JSON.stringify({
          success: false,
          error: "Failed to complete session",
          details: updateError.message,
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        session_id: session_id,
        summary: summary,
        completed_at: completedAt,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get" || action === "get_session") {
      if (!session_id) {
        return new Response(JSON.stringify({
          success: false,
          error: "session_id is required",
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: sess, error: getErr } = await supabase
        .from("helios_sessions")
        .select("*")
        .eq("session_id", session_id)
        .single();

      if (getErr || !sess) {
        return new Response(JSON.stringify({
          success: false,
          error: "Session not found",
          details: getErr?.message,
        }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        session_id: sess.session_id,
        current_phase: sess.current_phase,
        phase: sess.current_phase, // alias for compatibility
        specialty: sess.specialty,
        messages: sess.messages || [],
        patient_info: sess.patient_info || {},
        red_flags: sess.red_flags || [],
        escalated: sess.escalation_triggered || false,
        created_at: sess.created_at,
        updated_at: sess.updated_at,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: false, error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
