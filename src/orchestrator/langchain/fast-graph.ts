/**
 * Fast HELIOS Orchestrator
 * Optimized for speed - minimal agents, parallel execution, Haiku model
 */

import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { SupportedLanguage } from './setup';

// Fast model (Haiku) - initialized lazily
let _fastModel: ChatAnthropic | null = null;
let _apiKey: string | null = null;

export function setFastApiKey(apiKey: string) {
  _apiKey = apiKey;
  _fastModel = null;
}

function getFastModel(): ChatAnthropic {
  if (_fastModel) return _fastModel;

  const key = _apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY required');

  _fastModel = new ChatAnthropic({
    modelName: 'claude-sonnet-4-20250514', // Fast and capable
    anthropicApiKey: key,
    temperature: 0.1,
    maxTokens: 1024, // Shorter responses
  });

  return _fastModel;
}

export interface FastResult {
  response: string;
  phase: string;
  redFlags: string[];
  escalated: boolean;
  processingTimeMs: number;
}

// Safety keywords that trigger immediate escalation
const CRITICAL_KEYWORDS = [
  'chest pain', 'can\'t breathe', 'stroke', 'heart attack',
  'suicide', 'kill myself', 'overdose', 'unconscious',
  'severe bleeding', 'choking', 'seizure', 'anaphylaxis'
];

/**
 * Fast single-pass orchestration
 * Uses ONE optimized prompt instead of 107 agents
 */
export async function runFastOrchestration(
  sessionId: string,
  language: SupportedLanguage,
  userMessage: string,
  caseData: Record<string, unknown>
): Promise<FastResult> {
  const startTime = Date.now();

  // Quick safety check (no LLM needed)
  const lowerMessage = userMessage.toLowerCase();
  for (const keyword of CRITICAL_KEYWORDS) {
    if (lowerMessage.includes(keyword)) {
      return {
        response: getEscalationResponse(language, keyword),
        phase: 'escalated',
        redFlags: [`Critical symptom detected: ${keyword}`],
        escalated: true,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  const currentPhase = (caseData.phase as string) || 'intake';
  const model = getFastModel();

  // Single optimized prompt that combines all agent logic
  const systemPrompt = getOptimizedSystemPrompt(language, currentPhase, caseData);

  try {
    const response = await model.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userMessage),
    ]);

    const content = response.content as string;
    const parsed = parseResponse(content, currentPhase);

    return {
      response: parsed.message,
      phase: parsed.nextPhase,
      redFlags: parsed.redFlags,
      escalated: parsed.redFlags.some(f => f.includes('CRITICAL')),
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('Fast orchestration error:', error);
    return {
      response: getErrorResponse(language),
      phase: currentPhase,
      redFlags: [],
      escalated: false,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

function getOptimizedSystemPrompt(
  language: SupportedLanguage,
  phase: string,
  caseData: Record<string, unknown>
): string {
  const langInstructions: Record<SupportedLanguage, string> = {
    en: 'Respond in English.',
    es: 'Responde en español.',
    fr: 'Répondez en français.',
  };

  const existingInfo = caseData.chiefComplaint
    ? `\nKnown information:\n- Chief complaint: ${caseData.chiefComplaint}\n- Symptoms: ${JSON.stringify(caseData.symptoms || [])}`
    : '';

  return `You are HELIOS, an AI health triage assistant. ${langInstructions[language]}

CURRENT PHASE: ${phase}
${existingInfo}

Your role is to:
1. Gather symptom information conversationally
2. Identify any red flags or emergencies
3. Guide the patient to appropriate care

RULES:
- Be empathetic but concise
- Ask ONE follow-up question at a time
- Flag emergencies immediately with [RED_FLAG: description]
- Never diagnose - only gather information and triage
- If symptoms suggest emergency, recommend immediate care

RESPONSE FORMAT:
[PHASE: intake|history|triage|plan|completed]
[RED_FLAGS: none OR comma-separated list]

Your response to the patient:
(Your conversational message here)

---
Remember: You're gathering information to help connect them with the right level of care, not providing medical diagnosis.`;
}

function parseResponse(content: string, currentPhase: string): {
  message: string;
  nextPhase: string;
  redFlags: string[];
} {
  const lines = content.split('\n');
  let nextPhase = currentPhase;
  let redFlags: string[] = [];
  let messageLines: string[] = [];
  let inMessage = false;

  for (const line of lines) {
    if (line.startsWith('[PHASE:')) {
      const match = line.match(/\[PHASE:\s*(\w+)\]/);
      if (match) nextPhase = match[1];
    } else if (line.startsWith('[RED_FLAGS:')) {
      const match = line.match(/\[RED_FLAGS:\s*(.+)\]/);
      if (match && match[1].toLowerCase() !== 'none') {
        redFlags = match[1].split(',').map(f => f.trim());
      }
    } else if (line.trim() && !line.startsWith('[')) {
      inMessage = true;
      messageLines.push(line);
    }
  }

  // If no structured format found, use the whole response
  let message = messageLines.join('\n').trim();
  if (!message) {
    message = content.replace(/\[PHASE:[^\]]+\]/g, '')
                     .replace(/\[RED_FLAGS:[^\]]+\]/g, '')
                     .trim();
  }

  return { message, nextPhase, redFlags };
}

function getEscalationResponse(language: SupportedLanguage, trigger: string): string {
  const responses: Record<SupportedLanguage, string> = {
    en: `I'm concerned about what you've described. "${trigger}" can be a sign of a medical emergency. Please call 911 or go to the nearest emergency room immediately. If you're unable to do so, have someone help you. Your safety is the priority.`,
    es: `Me preocupa lo que has descrito. "${trigger}" puede ser señal de una emergencia médica. Por favor llama al 911 o ve a la sala de emergencias más cercana inmediatamente. Si no puedes hacerlo, pide ayuda a alguien. Tu seguridad es la prioridad.`,
    fr: `Ce que vous décrivez m'inquiète. "${trigger}" peut être le signe d'une urgence médicale. Veuillez appeler le 15 ou vous rendre aux urgences les plus proches immédiatement. Si vous ne pouvez pas le faire, demandez de l'aide. Votre sécurité est la priorité.`,
  };
  return responses[language];
}

function getErrorResponse(language: SupportedLanguage): string {
  const responses: Record<SupportedLanguage, string> = {
    en: "I apologize, I encountered an issue. Could you please repeat that?",
    es: "Lo siento, encontré un problema. ¿Podrías repetir eso?",
    fr: "Je m'excuse, j'ai rencontré un problème. Pourriez-vous répéter?",
  };
  return responses[language];
}

/**
 * Fast orchestrator class (drop-in replacement)
 */
export class FastHeliosOrchestrator {
  constructor(apiKey?: string) {
    if (apiKey) setFastApiKey(apiKey);
  }

  async process(
    caseState: { session_id: string; language: string; current_phase: string; [key: string]: unknown },
    userMessage: string
  ) {
    const result = await runFastOrchestration(
      caseState.session_id,
      caseState.language as SupportedLanguage,
      userMessage,
      {
        phase: caseState.current_phase,
        chiefComplaint: caseState.chief_complaint,
        symptoms: caseState.symptom_entities,
      }
    );

    return {
      sessionId: caseState.session_id,
      finalPhase: result.phase,
      teamOutputs: [],
      finalResponse: result.response,
      redFlags: result.redFlags.map(desc => ({
        rule_id: 'fast_check',
        severity: desc.includes('CRITICAL') ? 'critical' : 'high',
        description: desc,
        action_required: 'review',
      })),
      escalated: result.escalated,
      totalTokensUsed: 0,
      totalProcessingTimeMs: result.processingTimeMs,
    };
  }
}
