/**
 * LangChain Bridge for HELIOS
 * Connects the existing HELIOS orchestrator to the new LangChain multi-agent system
 */

import type { CaseState, Phase, RedFlag } from '../types/index.js';
import type { OrchestratorResult, TeamOutput } from '../agents/types.js';
import type { SupportedLanguage } from '../config/languages.js';

// Import from the new LangChain orchestrator
// Note: These imports point to the new src/orchestrator/langchain module
import { setAnthropicApiKey } from '../../../../src/orchestrator/langchain/setup.js';
import {
  HeliosOrchestrator as LangChainOrchestrator,
  getOrchestrator,
  runHeliosOrchestration,
  GraphState
} from '../../../../src/orchestrator/langchain/graph.js';
import {
  runIntakeTeam,
  runHistoryTeam,
  runTriageTeam,
  runDifferentialTeam,
  runSafetyTeam,
  runPlanTeam,
  runDocumentationTeam,
  TeamResult
} from '../../../../src/orchestrator/langchain/teams.js';
import {
  buildDifferentialConsensus,
  buildTriageConsensus,
  buildSafetyConsensus,
  ConsensusResult
} from '../../../../src/orchestrator/langchain/consensus.js';
import { AgentState, SafetyFlag } from '../../../../src/orchestrator/langchain/nodes.js';
import { createHumanMessage } from '../../../../src/orchestrator/langchain/setup.js';

/**
 * Bridge class that wraps the new LangChain orchestrator
 * with the existing HELIOS interface
 */
export class LangChainBridge {
  private orchestrator: LangChainOrchestrator;

  constructor(apiKey?: string) {
    // Set API key before initializing orchestrator
    if (apiKey) {
      setAnthropicApiKey(apiKey);
    }
    this.orchestrator = getOrchestrator();
  }

  /**
   * Process using the new multi-agent system
   * Returns data in the existing OrchestratorResult format
   */
  async process(
    caseState: CaseState,
    userMessage: string
  ): Promise<OrchestratorResult> {
    const startTime = Date.now();

    try {
      // Convert CaseState to the format expected by LangChain orchestrator
      const caseData = this.convertCaseStateToData(caseState);

      // Run the new orchestrator
      const result = await this.orchestrator.run(
        caseState.session_id,
        caseState.language as SupportedLanguage,
        userMessage,
        caseData
      );

      // Convert result back to OrchestratorResult format
      return this.convertToOrchestratorResult(
        caseState.session_id,
        result,
        startTime
      );
    } catch (error) {
      console.error('LangChain orchestration failed:', error);

      return {
        sessionId: caseState.session_id,
        finalPhase: caseState.current_phase,
        teamOutputs: [],
        finalResponse: this.getErrorResponse(caseState.language as SupportedLanguage),
        redFlags: [],
        escalated: false,
        totalTokensUsed: 0,
        totalProcessingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Run a specific team using the new system
   */
  async runTeam(
    teamName: 'intake' | 'history' | 'triage' | 'differential' | 'safety' | 'plan' | 'documentation',
    caseState: CaseState,
    userMessage?: string
  ): Promise<TeamResult> {
    const state = this.convertToAgentState(caseState, userMessage);

    switch (teamName) {
      case 'intake':
        return runIntakeTeam(caseState.session_id, state);
      case 'history':
        return runHistoryTeam(caseState.session_id, state, userMessage || '');
      case 'triage':
        return runTriageTeam(caseState.session_id, state);
      case 'differential':
        return runDifferentialTeam(caseState.session_id, state);
      case 'safety':
        return runSafetyTeam(caseState.session_id, state);
      case 'plan':
        return runPlanTeam(caseState.session_id, state);
      case 'documentation':
        return runDocumentationTeam(caseState.session_id, state);
      default:
        throw new Error(`Unknown team: ${teamName}`);
    }
  }

  /**
   * Build consensus using the new system
   */
  async buildConsensus(
    type: 'differential' | 'triage' | 'safety',
    caseState: CaseState
  ): Promise<ConsensusResult> {
    const caseData = this.convertCaseStateToData(caseState);

    switch (type) {
      case 'differential':
        return buildDifferentialConsensus(
          caseState.session_id,
          caseState.symptom_entities?.map(s => s.symptom) || [],
          caseData,
          caseState.language
        );
      case 'triage':
        return buildTriageConsensus(caseState.session_id, caseData);
      case 'safety':
        return buildSafetyConsensus(
          caseState.session_id,
          caseState.red_flags?.map(f => f.description) || [],
          caseData
        );
      default:
        throw new Error(`Unknown consensus type: ${type}`);
    }
  }

  // ========================================
  // CONVERTERS
  // ========================================

  private convertCaseStateToData(caseState: CaseState): Record<string, unknown> {
    return {
      sessionId: caseState.session_id,
      phase: caseState.current_phase,
      chiefComplaint: caseState.chief_complaint,
      symptoms: caseState.symptom_entities?.map(s => s.symptom) || [],
      symptomEntities: caseState.symptom_entities,
      patientAge: caseState.patient_demographics?.age,
      patientSex: caseState.patient_demographics?.sex,
      pregnant: caseState.patient_demographics?.pregnant,
      demographics: caseState.patient_demographics,
      medicalHistory: caseState.medical_history,
      medications: caseState.medications,
      allergies: caseState.allergies,
      redFlags: caseState.red_flags,
      triageLevel: caseState.triage_level,
      disposition: caseState.disposition,
      hypothesisList: caseState.hypothesis_list,
      escalationTriggered: caseState.escalation_triggered,
      escalationReason: caseState.escalation_reason,
      phaseHistory: caseState.phase_history,
    };
  }

  private convertToAgentState(caseState: CaseState, userMessage?: string): AgentState {
    return {
      sessionId: caseState.session_id,
      language: caseState.language as SupportedLanguage,
      currentPhase: caseState.current_phase,
      messages: userMessage ? [createHumanMessage(userMessage)] : [],
      caseData: this.convertCaseStateToData(caseState),
      agentOutputs: new Map(),
      consensusVotes: new Map(),
      pendingConsultations: [],
      safetyFlags: this.convertRedFlagsToSafetyFlags(caseState.red_flags || []),
      nextAgent: undefined,
    };
  }

  private convertRedFlagsToSafetyFlags(redFlags: RedFlag[]): SafetyFlag[] {
    return redFlags.map(rf => ({
      ruleId: rf.rule_id || 'unknown',
      severity: rf.severity as 'critical' | 'high' | 'moderate',
      description: rf.description,
      detectedBy: 'legacy_system',
      timestamp: Date.now(),
    }));
  }

  private convertToOrchestratorResult(
    sessionId: string,
    result: {
      response: string;
      phase: string;
      safetyFlags: SafetyFlag[];
      agentOutputs: Map<string, unknown>;
      escalated: boolean;
    },
    startTime: number
  ): OrchestratorResult {
    // Convert agent outputs to team outputs
    const teamOutputs: TeamOutput[] = [];
    const outputsByTeam = new Map<string, any[]>();

    result.agentOutputs.forEach((output, agentId) => {
      const teamMatch = agentId.match(/^([a-z]+)_/);
      const team = teamMatch ? teamMatch[1] : 'unknown';

      if (!outputsByTeam.has(team)) {
        outputsByTeam.set(team, []);
      }
      outputsByTeam.get(team)!.push({
        agentId,
        ...output as object,
      });
    });

    outputsByTeam.forEach((outputs, team) => {
      // Map new team names to legacy team names
      const teamMapping: Record<string, string> = {
        'intake': 'history',
        'safety': 'red_flags',
      };
      const mappedTeam = teamMapping[team] || team;

      // Only include teams that exist in the legacy type
      const validTeams = ['history', 'triage', 'differential', 'plan', 'red_flags', 'booking', 'documentation'];
      if (!validTeams.includes(mappedTeam)) return;

      teamOutputs.push({
        team: mappedTeam as 'history' | 'triage' | 'differential' | 'plan' | 'red_flags' | 'booking' | 'documentation',
        phase: result.phase as Phase,
        agentOutputs: outputs,
        finalRecommendation: outputs[outputs.length - 1]?.content || '',
        confidence: outputs.reduce((sum, o) => sum + (o.confidence || 0.5), 0) / outputs.length,
      });
    });

    // Convert safety flags to red flags
    const redFlags: RedFlag[] = result.safetyFlags.map(sf => ({
      rule_id: sf.ruleId,
      severity: sf.severity,
      description: sf.description,
      action_required: sf.severity === 'critical' ? 'immediate_escalation' : 'monitor',
    }));

    return {
      sessionId,
      finalPhase: result.phase as Phase,
      teamOutputs,
      finalResponse: result.response,
      redFlags,
      escalated: result.escalated,
      totalTokensUsed: 0, // Token tracking handled differently in LangChain
      totalProcessingTimeMs: Date.now() - startTime,
    };
  }

  private getErrorResponse(language: SupportedLanguage): string {
    const templates: Record<SupportedLanguage, string> = {
      en: "I apologize, but I encountered an issue. Please try again or seek direct medical attention if urgent.",
      es: "Lo siento, encontré un problema. Por favor intenta de nuevo o busca atención médica directa si es urgente.",
      fr: "Je m'excuse, j'ai rencontré un problème. Veuillez réessayer ou consulter directement si urgent.",
    };
    return templates[language];
  }
}

/**
 * Factory function that returns either the legacy or LangChain orchestrator
 * based on configuration
 */
export function createBridgedOrchestrator(
  useLangChain: boolean = true,
  apiKey?: string
): LangChainBridge {
  if (useLangChain) {
    return new LangChainBridge(apiKey);
  }
  // For backwards compatibility, could return legacy orchestrator here
  // For now, always use LangChain
  return new LangChainBridge(apiKey);
}

// Re-export types for convenience
export type { TeamResult, ConsensusResult };
