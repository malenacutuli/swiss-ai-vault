/**
 * HELIOS Orchestrator
 * Coordinates multi-agent clinical triage workflow
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  AgentContext, AgentOutput, TeamOutput, OrchestratorConfig,
  OrchestratorResult
} from '../agents/types.js';
import type { CaseState, Phase, RedFlag } from '../types/index.js';
import type { SupportedLanguage } from '../config/languages.js';
import { createHistoryTeam } from '../agents/history/index.js';
import { createTriageTeam } from '../agents/triage/index.js';
import { createDifferentialTeam } from '../agents/differential/index.js';
import { createDocumentationTeam } from '../agents/documentation/index.js';
import { checkSafetyRules, type PatientState } from '../safety/rules.js';
import { knowledgeAggregator } from '../knowledge/index.js';
import { logger } from '../utils/logger.js';

export class HeliosOrchestrator {
  private client: Anthropic;
  // @ts-expect-error - Config stored for future features (timeouts, parallel execution)
  private _config: OrchestratorConfig;

  // Agent teams
  private historyTeam: ReturnType<typeof createHistoryTeam>;
  private triageTeam: ReturnType<typeof createTriageTeam>;
  private differentialTeam: ReturnType<typeof createDifferentialTeam>;
  private documentationTeam: ReturnType<typeof createDocumentationTeam>;

  constructor(apiKey: string, config?: Partial<OrchestratorConfig>) {
    this.client = new Anthropic({ apiKey });
    this._config = {
      maxIterations: 10,
      consensusThreshold: 0.7,
      timeoutMs: 60000,
      parallelExecution: true,
      ...config,
    };

    // Initialize teams
    this.historyTeam = createHistoryTeam(this.client);
    this.triageTeam = createTriageTeam(this.client);
    this.differentialTeam = createDifferentialTeam(this.client);
    this.documentationTeam = createDocumentationTeam(this.client);

    logger.info('HELIOS Orchestrator initialized');
  }

  // ========================================
  // MAIN ORCHESTRATION LOOP
  // ========================================

  async process(
    caseState: CaseState,
    userMessage: string
  ): Promise<OrchestratorResult> {
    const startTime = Date.now();
    const teamOutputs: TeamOutput[] = [];
    let totalTokens = 0;

    logger.info('Starting orchestration', {
      sessionId: caseState.session_id,
      phase: caseState.current_phase,
      language: caseState.language,
    });

    try {
      // Step 1: ALWAYS check safety rules first (deterministic)
      const safetyCheck = this.checkSafety(caseState, userMessage);
      if (safetyCheck.requiresEscalation) {
        logger.warn('Safety escalation triggered', {
          sessionId: caseState.session_id,
          reason: safetyCheck.escalationReason,
        });

        return {
          sessionId: caseState.session_id,
          finalPhase: 'escalated',
          teamOutputs: [],
          finalResponse: safetyCheck.escalationReason || 'Emergency escalation required',
          redFlags: safetyCheck.redFlags,
          escalated: true,
          totalTokensUsed: 0,
          totalProcessingTimeMs: Date.now() - startTime,
        };
      }

      // Build context for agents
      const context: AgentContext = {
        sessionId: caseState.session_id,
        caseState,
        language: caseState.language as SupportedLanguage,
        currentPhase: caseState.current_phase,
        previousOutputs: new Map(),
      };

      // Step 2: Route to appropriate team based on phase
      let response: string = '';
      let nextPhase: Phase = caseState.current_phase;

      switch (caseState.current_phase) {
        case 'intake':
        case 'chief_complaint': {
          const output = await this.runHistoryTeam(context, userMessage, 'chief_complaint');
          teamOutputs.push(output);
          totalTokens += this.sumTokens(output.agentOutputs);
          response = this.formatHistoryResponse(output, context.language);
          nextPhase = output.agentOutputs[0]?.recommendedPhase || 'history_taking';
          break;
        }

        case 'history_taking': {
          const output = await this.runHistoryTeam(context, userMessage, 'hpi');
          teamOutputs.push(output);
          totalTokens += this.sumTokens(output.agentOutputs);
          response = this.formatHistoryResponse(output, context.language);

          // Check if history is complete enough for triage
          const completeness = (output.agentOutputs[0]?.structuredOutput as { completeness?: number })?.completeness || 0;
          nextPhase = completeness >= 0.7 ? 'triage' : 'history_taking';
          break;
        }

        case 'triage': {
          const output = await this.runTriageTeam(context);
          teamOutputs.push(output);
          totalTokens += this.sumTokens(output.agentOutputs);
          response = this.formatTriageResponse(output, context.language);

          // Route based on ESI level
          const esiLevel = (output.agentOutputs[0]?.structuredOutput as { esi_level?: number })?.esi_level;
          nextPhase = (esiLevel || 3) <= 2 ? 'safety_gate' : 'differential';
          break;
        }

        case 'differential': {
          // Get knowledge for verification
          const knowledgeResults = await this.queryKnowledge(caseState);
          context.knowledgeResults = knowledgeResults;

          const output = await this.runDifferentialTeam(context);
          teamOutputs.push(output);
          totalTokens += this.sumTokens(output.agentOutputs);
          response = this.formatDifferentialResponse(output, context.language);
          nextPhase = 'plan';
          break;
        }

        case 'plan':
        case 'safety_gate': {
          // Run final safety check
          const finalSafety = this.checkSafety(caseState, '');
          if (finalSafety.requiresEscalation) {
            return {
              sessionId: caseState.session_id,
              finalPhase: 'escalated',
              teamOutputs,
              finalResponse: finalSafety.escalationReason || 'Safety check failed',
              redFlags: finalSafety.redFlags,
              escalated: true,
              totalTokensUsed: totalTokens,
              totalProcessingTimeMs: Date.now() - startTime,
            };
          }
          nextPhase = 'documentation';
          break;
        }

        case 'documentation': {
          const output = await this.runDocumentationTeam(context);
          teamOutputs.push(output);
          totalTokens += this.sumTokens(output.agentOutputs);
          response = this.formatDocumentationResponse(output, context.language);
          nextPhase = 'completed';
          break;
        }

        default:
          response = this.getDefaultResponse(context.language);
      }

      // Collect all red flags from team outputs
      const allRedFlags: RedFlag[] = [
        ...safetyCheck.redFlags,
        ...teamOutputs.flatMap(t =>
          t.agentOutputs.flatMap(a => a.extractedRedFlags || [])
        ),
      ];

      return {
        sessionId: caseState.session_id,
        finalPhase: nextPhase,
        teamOutputs,
        finalResponse: response,
        redFlags: allRedFlags,
        escalated: false,
        totalTokensUsed: totalTokens,
        totalProcessingTimeMs: Date.now() - startTime,
      };

    } catch (error) {
      logger.error('Orchestration failed', {
        sessionId: caseState.session_id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        sessionId: caseState.session_id,
        finalPhase: caseState.current_phase,
        teamOutputs,
        finalResponse: this.getErrorResponse(caseState.language as SupportedLanguage),
        redFlags: [],
        escalated: false,
        totalTokensUsed: totalTokens,
        totalProcessingTimeMs: Date.now() - startTime,
      };
    }
  }

  // ========================================
  // TEAM RUNNERS
  // ========================================

  private async runHistoryTeam(
    context: AgentContext,
    userMessage: string,
    focus: 'chief_complaint' | 'hpi'
  ): Promise<TeamOutput> {
    const agent = focus === 'chief_complaint'
      ? this.historyTeam.chiefComplaint
      : this.historyTeam.hpiGatherer;

    const output = await agent.execute({
      context,
      userMessage,
    });

    return {
      team: 'history',
      phase: context.currentPhase,
      agentOutputs: [output],
      finalRecommendation: output.content,
      confidence: output.confidence,
    };
  }

  private async runTriageTeam(context: AgentContext): Promise<TeamOutput> {
    // Run ESI calculator and disposition in parallel
    const [esiOutput, dispositionOutput] = await Promise.all([
      this.triageTeam.esiCalculator.execute({ context }),
      this.triageTeam.disposition.execute({ context }),
    ]);

    return {
      team: 'triage',
      phase: context.currentPhase,
      agentOutputs: [esiOutput, dispositionOutput],
      finalRecommendation: esiOutput.content,
      confidence: Math.min(esiOutput.confidence, dispositionOutput.confidence),
    };
  }

  private async runDifferentialTeam(context: AgentContext): Promise<TeamOutput> {
    const output = await this.differentialTeam.hypothesisGenerator.execute({
      context,
      taskDescription: 'Generate differential diagnosis considerations',
    });

    return {
      team: 'differential',
      phase: context.currentPhase,
      agentOutputs: [output],
      finalRecommendation: output.content,
      confidence: output.confidence,
    };
  }

  private async runDocumentationTeam(context: AgentContext): Promise<TeamOutput> {
    const output = await this.documentationTeam.soapWriter.execute({ context });

    return {
      team: 'documentation',
      phase: context.currentPhase,
      agentOutputs: [output],
      finalRecommendation: output.content,
      confidence: output.confidence,
    };
  }

  // ========================================
  // SAFETY & KNOWLEDGE
  // ========================================

  private checkSafety(caseState: CaseState, userMessage: string) {
    const patientState: PatientState = {
      age: caseState.patient_demographics?.age,
      ageUnit: caseState.patient_demographics?.age_unit,
      sex: caseState.patient_demographics?.sex,
      pregnant: caseState.patient_demographics?.pregnant,
      symptoms: caseState.symptom_entities?.map(s => s.symptom) || [],
      riskFactors: caseState.medical_history || [],
      medications: caseState.medications?.map(m => m.name) || [],
      messages: userMessage ? [userMessage] : [],
    };

    return checkSafetyRules(patientState, caseState.language as SupportedLanguage);
  }

  private async queryKnowledge(caseState: CaseState) {
    const symptoms = caseState.symptom_entities?.map(s => s.symptom) || [];
    if (symptoms.length === 0) return undefined;

    return knowledgeAggregator.queryWithConsensus({
      type: 'diagnosis',
      terms: symptoms,
      language: caseState.language as SupportedLanguage,
    });
  }

  // ========================================
  // RESPONSE FORMATTERS
  // ========================================

  private formatHistoryResponse(output: TeamOutput, language: SupportedLanguage): string {
    const agentOutput = output.agentOutputs[0];
    const questions = agentOutput?.questionsToAsk || [];

    if (questions.length > 0) {
      return questions[0];
    }

    return agentOutput?.content || this.getDefaultResponse(language);
  }

  private formatTriageResponse(output: TeamOutput, language: SupportedLanguage): string {
    // Combine ESI and disposition info
    const dispositionOutput = output.agentOutputs[1]?.structuredOutput as {
      rationale?: string;
      warning_signs?: string[];
    } | undefined;

    const templates: Record<SupportedLanguage, string> = {
      en: `Based on your symptoms, I've assessed your situation. ${dispositionOutput?.rationale || ''} ${(dispositionOutput?.warning_signs?.length || 0) > 0 ? `Please watch for: ${dispositionOutput?.warning_signs?.join(', ')}` : ''}`,
      es: `Según tus síntomas, he evaluado tu situación. ${dispositionOutput?.rationale || ''} ${(dispositionOutput?.warning_signs?.length || 0) > 0 ? `Por favor vigila: ${dispositionOutput?.warning_signs?.join(', ')}` : ''}`,
      fr: `D'après vos symptômes, j'ai évalué votre situation. ${dispositionOutput?.rationale || ''} ${(dispositionOutput?.warning_signs?.length || 0) > 0 ? `Veuillez surveiller: ${dispositionOutput?.warning_signs?.join(', ')}` : ''}`,
    };

    return templates[language];
  }

  private formatDifferentialResponse(output: TeamOutput, language: SupportedLanguage): string {
    const structured = output.agentOutputs[0]?.structuredOutput as { reasoning?: string } | undefined;

    const templates: Record<SupportedLanguage, string> = {
      en: `Based on the information you've provided, here are some considerations: ${structured?.reasoning || ''}\n\nRemember, this is not a diagnosis. Please see a healthcare provider for proper evaluation.`,
      es: `Basado en la información que has proporcionado, aquí hay algunas consideraciones: ${structured?.reasoning || ''}\n\nRecuerda, esto no es un diagnóstico. Por favor consulta con un profesional de la salud.`,
      fr: `Sur la base des informations fournies, voici quelques considérations: ${structured?.reasoning || ''}\n\nRappelez-vous, ceci n'est pas un diagnostic. Veuillez consulter un professionnel de santé.`,
    };

    return templates[language];
  }

  private formatDocumentationResponse(_output: TeamOutput, language: SupportedLanguage): string {
    const templates: Record<SupportedLanguage, string> = {
      en: "I've prepared a summary of our conversation. Your clinical documentation is ready for review by a healthcare provider.",
      es: "He preparado un resumen de nuestra conversación. Tu documentación clínica está lista para revisión por un profesional de la salud.",
      fr: "J'ai préparé un résumé de notre conversation. Votre documentation clinique est prête pour examen par un professionnel de santé.",
    };

    return templates[language];
  }

  private getDefaultResponse(language: SupportedLanguage): string {
    const templates: Record<SupportedLanguage, string> = {
      en: "I understand. Could you tell me more about what you're experiencing?",
      es: "Entiendo. ¿Podrías contarme más sobre lo que estás experimentando?",
      fr: "Je comprends. Pourriez-vous me dire plus sur ce que vous ressentez?",
    };
    return templates[language];
  }

  private getErrorResponse(language: SupportedLanguage): string {
    const templates: Record<SupportedLanguage, string> = {
      en: "I apologize, but I encountered an issue. Please try again or seek direct medical attention if urgent.",
      es: "Lo siento, encontré un problema. Por favor intenta de nuevo o busca atención médica directa si es urgente.",
      fr: "Je m'excuse, j'ai rencontré un problème. Veuillez réessayer ou consulter directement si urgent.",
    };
    return templates[language];
  }

  private sumTokens(outputs: AgentOutput[]): number {
    return outputs.reduce((sum, o) => sum + (o.tokensUsed || 0), 0);
  }
}

export function createOrchestrator(apiKey: string, config?: Partial<OrchestratorConfig>) {
  return new HeliosOrchestrator(apiKey, config);
}
