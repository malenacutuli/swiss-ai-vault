/**
 * HELIOS Session Edge Function
 * Handles health consultation sessions via Anthropic Claude
 */

import { corsHeaders } from '../_shared/cors.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

// Safety keywords that trigger immediate escalation
const CRITICAL_KEYWORDS = [
  'chest pain', "can't breathe", 'stroke', 'heart attack',
  'suicide', 'kill myself', 'overdose', 'unconscious',
  'severe bleeding', 'choking', 'seizure', 'anaphylaxis'
];

// In-memory session store (for edge function - stateless between invocations)
// In production, use Supabase database
const sessions = new Map<string, SessionState>();

interface SessionState {
  session_id: string;
  language: string;
  phase: string;
  chief_complaint?: string;
  symptoms: string[];
  hypotheses: string[];
  red_flags: string[];
  messages: Array<{ role: string; content: string }>;
  created_at: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, session_id, message, language = 'en', demographics } = await req.json();

    if (action === 'create') {
      return handleCreateSession(language);
    }

    if (action === 'message') {
      if (!session_id || !message) {
        return new Response(
          JSON.stringify({ error: 'session_id and message required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return handleMessage(session_id, message, language, demographics);
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use "create" or "message"' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('HELIOS session error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function handleCreateSession(language: string): Response {
  const sessionId = crypto.randomUUID();

  const session: SessionState = {
    session_id: sessionId,
    language,
    phase: 'intake',
    symptoms: [],
    hypotheses: [],
    red_flags: [],
    messages: [],
    created_at: new Date().toISOString(),
  };

  sessions.set(sessionId, session);

  const greeting = getGreeting(language);

  return new Response(
    JSON.stringify({
      session_id: sessionId,
      phase: 'intake',
      message: greeting,
      language,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleMessage(
  sessionId: string,
  userMessage: string,
  language: string,
  demographics?: { age?: number; sex?: string }
): Promise<Response> {
  // Get or create session
  let session = sessions.get(sessionId);
  if (!session) {
    session = {
      session_id: sessionId,
      language,
      phase: 'intake',
      symptoms: [],
      hypotheses: [],
      red_flags: [],
      messages: [],
      created_at: new Date().toISOString(),
    };
    sessions.set(sessionId, session);
  }

  // Quick safety check (no LLM needed)
  const lowerMessage = userMessage.toLowerCase();
  for (const keyword of CRITICAL_KEYWORDS) {
    if (lowerMessage.includes(keyword)) {
      const escalationResponse = getEscalationResponse(language, keyword);
      session.red_flags.push('Critical symptom detected: ' + keyword);
      session.phase = 'escalated';

      return new Response(
        JSON.stringify({
          session_id: sessionId,
          phase: 'escalated',
          message: escalationResponse,
          red_flags: session.red_flags,
          escalated: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // Add user message to history
  session.messages.push({ role: 'user', content: userMessage });

  // Set chief complaint from first user message
  if (!session.chief_complaint) {
    session.chief_complaint = userMessage;
  }

  // Call Claude for response
  const response = await callClaude(session, userMessage, language, demographics);

  // Add assistant response to history
  session.messages.push({ role: 'assistant', content: response.message });

  // Update session state
  if (response.phase) session.phase = response.phase;
  if (response.symptoms) session.symptoms = [...session.symptoms, ...response.symptoms];
  if (response.hypotheses) session.hypotheses = response.hypotheses;
  if (response.red_flags) session.red_flags = [...session.red_flags, ...response.red_flags];

  return new Response(
    JSON.stringify({
      session_id: sessionId,
      phase: session.phase,
      message: response.message,
      symptoms: session.symptoms,
      hypotheses: session.hypotheses,
      red_flags: session.red_flags,
      escalated: response.escalated || false,
      triage_level: response.triage_level,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function callClaude(
  session: SessionState,
  userMessage: string,
  language: string,
  demographics?: { age?: number; sex?: string }
): Promise<{
  message: string;
  phase?: string;
  symptoms?: string[];
  hypotheses?: string[];
  red_flags?: string[];
  escalated?: boolean;
  triage_level?: string;
}> {
  if (!ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not configured');
    return {
      message: getErrorResponse(language),
      phase: session.phase,
    };
  }

  const systemPrompt = buildSystemPrompt(session, language, demographics);

  // Build conversation history
  const messages = session.messages.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', response.status, errorText);
      return {
        message: getErrorResponse(language),
        phase: session.phase,
      };
    }

    const data = await response.json();
    const content = data.content[0]?.text || '';

    return parseClaudeResponse(content, session.phase);

  } catch (error) {
    console.error('Claude API call failed:', error);
    return {
      message: getErrorResponse(language),
      phase: session.phase,
    };
  }
}

function buildSystemPrompt(
  session: SessionState,
  language: string,
  demographics?: { age?: number; sex?: string }
): string {
  const langInstructions: Record<string, string> = {
    en: 'Respond in English.',
    es: 'Responde en español.',
    fr: 'Répondez en français.',
  };

  const demographicInfo = demographics
    ? '\nPatient: ' + (demographics.age || 'unknown') + ' year old ' + (demographics.sex || 'unknown')
    : '';

  const existingInfo = session.chief_complaint
    ? '\nKnown information:\n- Chief complaint: ' + session.chief_complaint + '\n- Symptoms: ' + JSON.stringify(session.symptoms)
    : '';

  return 'You are HELIOS, an AI health triage assistant. ' + (langInstructions[language] || langInstructions.en) + '\n\nCURRENT PHASE: ' + session.phase + demographicInfo + existingInfo + '\n\nYour role is to:\n1. Gather symptom information conversationally\n2. Identify any red flags or emergencies\n3. Guide the patient to appropriate care\n\nRULES:\n- Be empathetic but concise\n- Ask ONE follow-up question at a time\n- Flag emergencies immediately with [RED_FLAG: description]\n- Never diagnose - only gather information and triage\n- If symptoms suggest emergency, recommend immediate care\n\nRESPONSE FORMAT:\n[PHASE: intake|history|triage|plan|documentation|completed]\n[RED_FLAGS: none OR comma-separated list]\n[SYMPTOMS: comma-separated list of identified symptoms]\n[HYPOTHESES: comma-separated list of possible conditions to investigate]\n\nYour response to the patient:\n(Your conversational message here)\n\n---\nRemember: You are gathering information to help connect them with the right level of care, not providing medical diagnosis.';
}

function parseClaudeResponse(content: string, currentPhase: string): {
  message: string;
  phase?: string;
  symptoms?: string[];
  hypotheses?: string[];
  red_flags?: string[];
  escalated?: boolean;
  triage_level?: string;
} {
  const lines = content.split('\n');
  let phase = currentPhase;
  let redFlags: string[] = [];
  let symptoms: string[] = [];
  let hypotheses: string[] = [];
  const messageLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('[PHASE:')) {
      const match = line.match(/\[PHASE:\s*(\w+)\]/);
      if (match) phase = match[1];
    } else if (line.startsWith('[RED_FLAGS:')) {
      const match = line.match(/\[RED_FLAGS:\s*(.+)\]/);
      if (match && match[1].toLowerCase() !== 'none') {
        redFlags = match[1].split(',').map(f => f.trim());
      }
    } else if (line.startsWith('[SYMPTOMS:')) {
      const match = line.match(/\[SYMPTOMS:\s*(.+)\]/);
      if (match && match[1].toLowerCase() !== 'none') {
        symptoms = match[1].split(',').map(s => s.trim());
      }
    } else if (line.startsWith('[HYPOTHESES:')) {
      const match = line.match(/\[HYPOTHESES:\s*(.+)\]/);
      if (match && match[1].toLowerCase() !== 'none') {
        hypotheses = match[1].split(',').map(h => h.trim());
      }
    } else if (line.trim() && !line.startsWith('[')) {
      messageLines.push(line);
    }
  }

  // If no structured format found, use the whole response
  let message = messageLines.join('\n').trim();
  if (!message) {
    message = content
      .replace(/\[PHASE:[^\]]+\]/g, '')
      .replace(/\[RED_FLAGS:[^\]]+\]/g, '')
      .replace(/\[SYMPTOMS:[^\]]+\]/g, '')
      .replace(/\[HYPOTHESES:[^\]]+\]/g, '')
      .trim();
  }

  return {
    message,
    phase,
    symptoms: symptoms.length > 0 ? symptoms : undefined,
    hypotheses: hypotheses.length > 0 ? hypotheses : undefined,
    red_flags: redFlags.length > 0 ? redFlags : undefined,
    escalated: redFlags.some(f => f.includes('CRITICAL')),
  };
}

function getGreeting(language: string): string {
  const greetings: Record<string, string> = {
    en: "Hello! I'm HELIOS, your AI health assistant. I'll help gather information about your symptoms to connect you with the right care. This is not a substitute for professional medical advice. What brings you in today?",
    es: "Hola! Soy HELIOS, tu asistente de salud con IA. Te ayudaré a recopilar información sobre tus síntomas para conectarte con la atención adecuada. Esto no sustituye el consejo médico profesional. ¿Qué te trae hoy?",
    fr: "Bonjour! Je suis HELIOS, votre assistant de santé IA. Je vais vous aider à recueillir des informations sur vos symptômes pour vous orienter vers les soins appropriés. Ceci ne remplace pas les conseils médicaux professionnels. Qu'est-ce qui vous amène aujourd'hui?",
  };
  return greetings[language] || greetings.en;
}

function getEscalationResponse(language: string, trigger: string): string {
  const responses: Record<string, string> = {
    en: 'I am concerned about what you have described. "' + trigger + '" can be a sign of a medical emergency. Please call 911 or go to the nearest emergency room immediately. If you are unable to do so, have someone help you. Your safety is the priority.',
    es: 'Me preocupa lo que has descrito. "' + trigger + '" puede ser señal de una emergencia médica. Por favor llama al 911 o ve a la sala de emergencias más cercana inmediatamente. Si no puedes hacerlo, pide ayuda a alguien. Tu seguridad es la prioridad.',
    fr: 'Ce que vous décrivez m inquiète. "' + trigger + '" peut être le signe d une urgence médicale. Veuillez appeler le 15 ou vous rendre aux urgences les plus proches immédiatement. Si vous ne pouvez pas le faire, demandez de l aide. Votre sécurité est la priorité.',
  };
  return responses[language] || responses.en;
}

function getErrorResponse(language: string): string {
  const responses: Record<string, string> = {
    en: "I apologize, I encountered an issue processing your message. Could you please try again?",
    es: "Lo siento, encontré un problema procesando tu mensaje. ¿Podrías intentarlo de nuevo?",
    fr: "Je m'excuse, j'ai rencontré un problème lors du traitement de votre message. Pourriez-vous réessayer?",
  };
  return responses[language] || responses.en;
}
