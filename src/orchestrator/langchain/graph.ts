/**
 * HELIOS LangGraph Orchestrator
 * Main graph that connects all 107 agents
 */

import { RunnableConfig } from '@langchain/core/runnables';
import {
  createAgentNode,
  createSupervisorNode,
  createConsensusNode,
  AgentState,
  SafetyFlag
} from './nodes';
import {
  AGENT_REGISTRY,
  getSupervisorAgents,
  getAgentsByTeam,
  AgentTeam
} from './taxonomy';
import { SupportedLanguage, createHumanMessage } from './setup';

// Graph state for orchestration
export interface GraphState extends AgentState {
  iterationCount: number;
  maxIterations: number;
  completed: boolean;
  finalResponse: string;
}

// Phase definitions for routing
type Phase = 'intake' | 'chief_complaint' | 'history_taking' | 'triage' |
  'differential' | 'plan' | 'documentation' | 'safety_gate' | 'completed';

// Agent node function type
type AgentNodeFunc = (state: AgentState, config?: RunnableConfig) => Promise<Partial<AgentState>>;

/**
 * Create the HELIOS orchestration system
 * Uses a simplified hub-and-spoke pattern with central router
 */
export class HeliosOrchestrator {
  private agents: Map<string, AgentNodeFunc>;
  private supervisors: Map<string, AgentNodeFunc>;
  private consensusNode: AgentNodeFunc;

  constructor() {
    this.agents = new Map();
    this.supervisors = new Map();

    // Initialize supervisor nodes
    const supervisorAgents = getSupervisorAgents();
    for (const supervisor of supervisorAgents) {
      this.supervisors.set(supervisor.id, createSupervisorNode(supervisor.id));
    }

    // Initialize agent nodes for critical teams
    const criticalTeams: AgentTeam[] = [
      'intake', 'history', 'triage', 'differential',
      'safety', 'plan', 'documentation'
    ];

    for (const team of criticalTeams) {
      const teamAgents = getAgentsByTeam(team);
      for (const agent of teamAgents) {
        if (agent.tier !== 'supervisor') {
          this.agents.set(agent.id, createAgentNode(agent.id));
        }
      }
    }

    // Initialize consensus node
    this.consensusNode = createConsensusNode();
  }

  /**
   * Route to the appropriate agent based on current phase
   */
  private routeToAgent(state: GraphState): string | null {
    // Check for safety escalation first
    const criticalFlags = state.safetyFlags.filter(f => f.severity === 'critical');
    if (criticalFlags.length > 0) {
      return 'safety_chief';
    }

    // Check iteration limit
    if (state.iterationCount >= state.maxIterations) {
      return null; // Stop processing
    }

    // Route based on current phase
    switch (state.currentPhase as Phase) {
      case 'intake':
        return 'intake_chief';
      case 'chief_complaint':
        return 'history_cc';
      case 'history_taking':
        return 'history_chief';
      case 'triage':
        return 'triage_chief';
      case 'differential':
        return 'diff_chief';
      case 'plan':
        return 'plan_chief';
      case 'documentation':
        return 'doc_chief';
      case 'safety_gate':
        return 'safety_chief';
      case 'completed':
        return null;
      default:
        return 'orch_master';
    }
  }

  /**
   * Get the node function for an agent
   */
  private getAgentNode(agentId: string): AgentNodeFunc | null {
    return this.supervisors.get(agentId) || this.agents.get(agentId) || null;
  }

  /**
   * Execute a single step of the orchestration
   */
  private async executeStep(
    state: GraphState,
    config?: RunnableConfig
  ): Promise<GraphState> {
    const agentId = this.routeToAgent(state);

    if (!agentId) {
      return { ...state, completed: true };
    }

    const agentNode = this.getAgentNode(agentId);
    if (!agentNode) {
      console.warn(`Agent ${agentId} not found, skipping`);
      return {
        ...state,
        iterationCount: state.iterationCount + 1,
      };
    }

    try {
      const agentState: AgentState = {
        sessionId: state.sessionId,
        language: state.language,
        currentPhase: state.currentPhase,
        messages: state.messages,
        caseData: state.caseData,
        agentOutputs: state.agentOutputs,
        consensusVotes: state.consensusVotes,
        pendingConsultations: state.pendingConsultations,
        safetyFlags: state.safetyFlags,
        nextAgent: state.nextAgent,
      };

      const result = await agentNode(agentState, config);

      // Merge result into state
      return {
        ...state,
        ...result,
        agentOutputs: new Map([
          ...state.agentOutputs,
          ...(result.agentOutputs || new Map()),
        ]),
        safetyFlags: [
          ...state.safetyFlags,
          ...(result.safetyFlags || []),
        ],
        iterationCount: state.iterationCount + 1,
      };
    } catch (error) {
      console.error(`Error executing agent ${agentId}:`, error);
      return {
        ...state,
        iterationCount: state.iterationCount + 1,
      };
    }
  }

  /**
   * Run the full orchestration loop
   */
  async run(
    sessionId: string,
    language: SupportedLanguage,
    userMessage: string,
    caseData: Record<string, unknown>,
    config?: RunnableConfig
  ): Promise<{
    response: string;
    phase: string;
    safetyFlags: SafetyFlag[];
    agentOutputs: Map<string, unknown>;
    escalated: boolean;
  }> {
    let state: GraphState = {
      sessionId,
      language,
      currentPhase: 'intake',
      messages: [createHumanMessage(userMessage)],
      caseData,
      agentOutputs: new Map(),
      consensusVotes: new Map(),
      pendingConsultations: [],
      safetyFlags: [],
      nextAgent: undefined,
      iterationCount: 0,
      maxIterations: 50,
      completed: false,
      finalResponse: '',
    };

    // Main orchestration loop
    while (!state.completed && state.iterationCount < state.maxIterations) {
      state = await this.executeStep(state, config);

      // Check for immediate escalation
      const criticalFlags = state.safetyFlags.filter(f => f.severity === 'critical');
      if (criticalFlags.length > 0 && state.currentPhase === 'safety_gate') {
        // Force immediate human handoff
        state.completed = true;
        state.finalResponse = 'IMMEDIATE ESCALATION REQUIRED: ' +
          criticalFlags.map(f => f.description).join('; ');
      }
    }

    // Extract final response
    const outputEntries = Array.from(state.agentOutputs.entries());
    const lastOutput = outputEntries[outputEntries.length - 1]?.[1] as { content?: string } | undefined;

    const escalated = state.safetyFlags.some(f => f.severity === 'critical');

    return {
      response: lastOutput?.content || state.finalResponse || 'Unable to process request',
      phase: state.currentPhase,
      safetyFlags: state.safetyFlags,
      agentOutputs: state.agentOutputs,
      escalated,
    };
  }

  /**
   * Run consensus gathering among a set of agents
   */
  async runConsensus(
    state: GraphState,
    agentIds: string[],
    topic: string,
    config?: RunnableConfig
  ): Promise<{
    agreed: boolean;
    result: string;
    votes: Map<string, { vote: string; confidence: number }>;
  }> {
    // Gather votes from each agent
    const votes = new Map<string, { vote: string; confidence: number }>();

    for (const agentId of agentIds) {
      const agentNode = this.getAgentNode(agentId);
      if (!agentNode) continue;

      const agentState: AgentState = {
        ...state,
        caseData: {
          ...state.caseData,
          consensusTopic: topic,
          votingMode: true,
        },
      };

      const result = await agentNode(agentState, config);

      // Extract vote from agent output (stored in structuredData)
      const output = result.agentOutputs?.get(agentId);
      const voteData = output?.structuredData as { vote?: string; confidence?: number } | undefined;
      if (voteData?.vote) {
        votes.set(agentId, {
          vote: voteData.vote,
          confidence: voteData.confidence || output?.confidence || 0.5,
        });
      }
    }

    // Analyze votes
    const voteValues = Array.from(votes.values());
    const agreeVotes = voteValues.filter(v => v.vote === 'agree').length;
    const totalVotes = voteValues.length;
    const agreementRatio = totalVotes > 0 ? agreeVotes / totalVotes : 0;

    // 70% threshold for agreement
    const agreed = agreementRatio >= 0.7;

    return {
      agreed,
      result: agreed
        ? `Consensus reached with ${Math.round(agreementRatio * 100)}% agreement`
        : `No consensus: only ${Math.round(agreementRatio * 100)}% agreement`,
      votes,
    };
  }
}

// Singleton instance
let orchestratorInstance: HeliosOrchestrator | null = null;

/**
 * Get or create the orchestrator instance
 */
export function getOrchestrator(): HeliosOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new HeliosOrchestrator();
  }
  return orchestratorInstance;
}

/**
 * Convenience function to run orchestration
 */
export async function runHeliosOrchestration(
  sessionId: string,
  language: SupportedLanguage,
  userMessage: string,
  caseData: Record<string, unknown>,
  config?: RunnableConfig
): Promise<{
  response: string;
  phase: string;
  safetyFlags: SafetyFlag[];
  agentOutputs: Map<string, unknown>;
  escalated: boolean;
}> {
  const orchestrator = getOrchestrator();
  return orchestrator.run(sessionId, language, userMessage, caseData, config);
}
