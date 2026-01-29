import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.24.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

    // Specialty-specific system prompts
    const SPECIALTY_PROMPTS: Record<string, string> = {
      "primary-care": "You are HELIOS, an AI health assistant specializing in primary care. Help patients describe symptoms, discuss general health concerns, and provide guidance on when to see a doctor. Focus on holistic health assessment.",
      "cardiology": "You are HELIOS, an AI health assistant with cardiology focus. Help patients describe cardiac symptoms like chest pain, palpitations, shortness of breath. Ask about risk factors: family history, smoking, diabetes, blood pressure. Always recommend urgent care for severe symptoms.",
      "dermatology": "You are HELIOS, an AI health assistant with dermatology focus. Help patients describe skin conditions including location, appearance, duration, itching, and changes. Ask about sun exposure, allergies, and family history of skin conditions.",
      "mental-health": "You are HELIOS, an AI health assistant with mental health focus. Help patients discuss emotional well-being, stress, anxiety, mood changes. Be compassionate and non-judgmental. If someone expresses thoughts of self-harm, provide crisis resources immediately.",
      "pediatrics": "You are HELIOS, an AI health assistant with pediatrics focus. Help parents describe symptoms in children including age, duration, fever, eating/sleeping patterns. Use clear, reassuring language. Recommend pediatrician visits for concerning symptoms.",
      "womens-health": "You are HELIOS, an AI health assistant with women's health focus. Help patients discuss reproductive health, menstrual issues, pregnancy concerns, and menopause. Be sensitive and supportive when discussing personal health topics.",
      "orthopedics": "You are HELIOS, an AI health assistant with orthopedics focus. Help patients describe musculoskeletal issues: pain location, onset, movement limitations. Ask about injury history, activity level, and what makes symptoms better or worse.",
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

      // Context window management: estimate tokens and trim if needed
      // Rough estimate: 4 chars = 1 token, max ~8000 tokens for context
      const MAX_CONTEXT_CHARS = 24000;
      const KEEP_RECENT_MESSAGES = 6;

      let contextMessages = history.map((m: any) => ({ role: m.role, content: m.content }));

      // Calculate total context size
      const totalChars = contextMessages.reduce((sum: number, m: any) => sum + m.content.length, 0);

      // If context too large, create a summary of older messages
      if (totalChars > MAX_CONTEXT_CHARS && contextMessages.length > KEEP_RECENT_MESSAGES) {
        const olderMessages = contextMessages.slice(0, -KEEP_RECENT_MESSAGES);
        const recentMessages = contextMessages.slice(-KEEP_RECENT_MESSAGES);

        // Create a brief summary of older context
        const summaryParts: string[] = [];
        olderMessages.forEach((m: any) => {
          if (m.role === "user") {
            const snippet = m.content.substring(0, 100);
            summaryParts.push("Patient mentioned: " + snippet);
          }
        });
        const summary = summaryParts.slice(0, 5).join(". ");

        // Build new context with summary
        contextMessages = [
          { role: "user", content: "[Earlier in conversation: " + summary + "]" },
          { role: "assistant", content: "I understand. Let me continue helping you." },
          ...recentMessages,
        ];
      }

      contextMessages.push({ role: "user", content: message });

      // Build system prompt with specialty, language, and patient context
      let systemPrompt = SPECIALTY_PROMPTS[sessionSpecialty] || SPECIALTY_PROMPTS["primary-care"];
      systemPrompt += " Always recommend consulting a doctor for medical advice.";
      systemPrompt += " " + (LANGUAGE_INSTRUCTIONS[sessionLanguage] || LANGUAGE_INSTRUCTIONS["en"]);
      if (patientInfo.age || patientInfo.sex) {
        systemPrompt += " Patient info: ";
        if (patientInfo.age) systemPrompt += "Age " + patientInfo.age + ". ";
        if (patientInfo.sex) systemPrompt += "Sex: " + patientInfo.sex + ". ";
      }

      const resp = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: contextMessages,
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

    if (action === "get") {
      const { data: sess, error: getErr } = await supabase
        .from("helios_sessions")
        .select("*")
        .eq("session_id", session_id)
        .single();

      if (getErr || !sess) {
        return new Response(JSON.stringify({
          success: false,
          error: "Session not found",
        }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        session_id: sess.session_id,
        phase: sess.current_phase,
        messages: sess.messages || [],
        patient_info: sess.patient_info || {},
        red_flags: sess.red_flags || [],
        escalated: sess.escalation_triggered || false,
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
