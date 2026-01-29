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

    if (action === "create") {
      const sessionId = crypto.randomUUID();
      await supabase.from("helios_sessions").insert({
        session_id: sessionId,
        current_phase: "intake",
        messages: [],
        patient_info: patient_info || {},
      });

      return new Response(JSON.stringify({
        success: true,
        session_id: sessionId,
        phase: "intake",
        message: "Hello! What brings you in today?",
        caseState: { session_id: sessionId },
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
        .select("messages, patient_info")
        .eq("session_id", session_id)
        .single();

      const history = sess?.messages || [];
      const patientInfo = sess?.patient_info || {};

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

      // Build system prompt with patient context
      let systemPrompt = "You are HELIOS, an AI health assistant. You help patients describe symptoms and provide general health guidance. Always recommend consulting a doctor for medical advice.";
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
