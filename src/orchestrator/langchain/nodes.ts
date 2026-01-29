/**
 * LangGraph Agent Nodes
 * Each node represents an agent that can process and communicate
 */

import { ChatAnthropic } from '@langchain/anthropic';
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { RunnableConfig } from '@langchain/core/runnables';
import { AGENT_MODELS, SupportedLanguage } from './setup';
import { AGENT_REGISTRY, AgentDefinition, getAgentById } from './taxonomy';
import { AgentCommunicationBus, ConsultationResult } from './communication';

export interface AgentState {
  sessionId: string;
  language: SupportedLanguage;
  currentPhase: string;
  messages: BaseMessage[];
  caseData: Record<string, unknown>;
  agentOutputs: Map<string, AgentOutput>;
  consensusVotes: Map<string, ConsensusVote>;
  pendingConsultations: string[];
  safetyFlags: SafetyFlag[];
  nextAgent?: string;
}

export interface AgentOutput {
  agentId: string;
  content: string;
  structuredData?: Record<string, unknown>;
  confidence: number;
  consultationsPerformed: string[];
  timestamp: number;
}

export interface ConsensusVote {
  agentId: string;
  topic: string;
  vote: 'agree' | 'disagree' | 'abstain';
  reasoning: string;
  confidence: number;
}

export interface SafetyFlag {
  ruleId: string;
  severity: 'critical' | 'high' | 'moderate';
  description: string;
  detectedBy: string;
  timestamp: number;
}

/**
 * Base Agent Node
 * Creates a LangGraph-compatible node for any agent
 */
export function createAgentNode(agentId: string) {
  const agentDef = getAgentById(agentId);
  if (!agentDef) {
    throw new Error(`Agent ${agentId} not found in registry`);
  }

  // Select model based on agent config
  const model = agentDef.model === 'opus'
    ? AGENT_MODELS.CLINICAL_REASONING
    : agentDef.model === 'sonnet'
    ? AGENT_MODELS.ORCHESTRATION
    : AGENT_MODELS.EXTRACTION;

  return async (
    state: AgentState,
    config?: RunnableConfig
  ): Promise<Partial<AgentState>> => {
    const startTime = Date.now();
    const bus = new AgentCommunicationBus(agentId, state.sessionId);
    const consultationsPerformed: string[] = [];

    try {
      // Build system prompt for this agent
      const systemPrompt = buildAgentSystemPrompt(agentDef, state);

      // Get context from previous agent outputs
      const previousContext = gatherPreviousContext(state, agentDef);

      // Perform any required consultations BEFORE generating response
      const consultationResults = await performRequiredConsultations(
        agentDef,
        bus,
        state,
        previousContext
      );
      consultationsPerformed.push(...consultationResults.map(c => c.consultedAgent));

      // Build messages for the LLM
      const messages: BaseMessage[] = [
        new SystemMessage(systemPrompt),
        ...state.messages,
        new HumanMessage(buildAgentPrompt(agentDef, state, consultationResults)),
      ];

      // Invoke the model
      const response = await model.invoke(messages, config);

      // Parse the response
      const parsedOutput = parseAgentResponse(agentDef, response.content as string);

      // Determine next agent based on output
      const nextAgent = determineNextAgent(agentDef, parsedOutput, state);

      // Check for safety flags
      const safetyFlags = checkForSafetyFlags(agentDef, parsedOutput, state);

      // Create agent output
      const output: AgentOutput = {
        agentId,
        content: response.content as string,
        structuredData: parsedOutput,
        confidence: (parsedOutput.confidence as number) || 0.7,
        consultationsPerformed,
        timestamp: Date.now(),
      };

      // Update state
      const newAgentOutputs = new Map(state.agentOutputs);
      newAgentOutputs.set(agentId, output);

      return {
        agentOutputs: newAgentOutputs,
        safetyFlags: [...state.safetyFlags, ...safetyFlags],
        nextAgent,
        messages: [
          ...state.messages,
          new AIMessage({
            content: response.content as string,
            additional_kwargs: { agentId, processingTimeMs: Date.now() - startTime },
          }),
        ],
      };

    } finally {
      await bus.cleanup();
    }
  };
}

/**
 * Supervisor Node
 * Coordinates multiple subordinate agents
 */
export function createSupervisorNode(supervisorId: string) {
  const supervisor = getAgentById(supervisorId);
  if (!supervisor || supervisor.tier !== 'supervisor') {
    throw new Error(`${supervisorId} is not a supervisor agent`);
  }

  const model = AGENT_MODELS.ORCHESTRATION;

  return async (
    state: AgentState,
    config?: RunnableConfig
  ): Promise<Partial<AgentState>> => {
    const bus = new AgentCommunicationBus(supervisorId, state.sessionId);

    try {
      // Get outputs from subordinates
      const subordinateOutputs = (supervisor.supervises || [])
        .map(id => state.agentOutputs.get(id))
        .filter(Boolean);

      // Build supervisor prompt
      const systemPrompt = buildSupervisorPrompt(supervisor, state);

      const messages: BaseMessage[] = [
        new SystemMessage(systemPrompt),
        new HumanMessage(`
          Review and synthesize the following outputs from your team:

          ${subordinateOutputs.map(o => `
            Agent: ${o!.agentId}
            Output: ${o!.content}
            Confidence: ${o!.confidence}
          `).join('\n---\n')}

          Provide your team's consolidated recommendation.
        `),
      ];

      const response = await model.invoke(messages, config);

      // Parse supervisor decision
      const decision = parseSupervisorDecision(response.content as string);

      // If consensus needed, collect votes
      if (decision.requiresConsensus) {
        const votes = await collectConsensusVotes(
          supervisor,
          bus,
          decision.consensusTopic!,
          state
        );

        const consensusResult = evaluateConsensus(votes);

        const newConsensusVotes = new Map(state.consensusVotes);
        votes.forEach(v => newConsensusVotes.set(v.agentId, v));

        return {
          consensusVotes: newConsensusVotes,
          nextAgent: consensusResult.achieved
            ? decision.nextAgentIfConsensus
            : decision.nextAgentIfNoConsensus,
        };
      }

      return {
        nextAgent: decision.nextAgent,
        messages: [
          ...state.messages,
          new AIMessage({
            content: response.content as string,
            additional_kwargs: { agentId: supervisorId, role: 'supervisor' },
          }),
        ],
      };

    } finally {
      await bus.cleanup();
    }
  };
}

/**
 * Consensus Node
 * Collects votes and determines agreement
 */
export function createConsensusNode() {
  return async (
    state: AgentState,
    _config?: RunnableConfig
  ): Promise<Partial<AgentState>> => {
    const votes = Array.from(state.consensusVotes.values());

    // Count votes
    const counts = {
      agree: votes.filter(v => v.vote === 'agree').length,
      disagree: votes.filter(v => v.vote === 'disagree').length,
      abstain: votes.filter(v => v.vote === 'abstain').length,
    };

    const total = votes.length - counts.abstain;
    const agreementPercentage = total > 0 ? counts.agree / total : 0;

    // Consensus achieved if >= 70% agreement
    const consensusAchieved = agreementPercentage >= 0.7;

    // Weight by confidence
    const weightedAgreement = votes
      .filter(v => v.vote === 'agree')
      .reduce((sum, v) => sum + v.confidence, 0);

    const weightedDisagreement = votes
      .filter(v => v.vote === 'disagree')
      .reduce((sum, v) => sum + v.confidence, 0);

    return {
      caseData: {
        ...state.caseData,
        consensusResult: {
          achieved: consensusAchieved,
          agreementPercentage,
          weightedAgreement,
          weightedDisagreement,
          votes: counts,
        },
      },
    };
  };
}

// Helper functions

function buildAgentSystemPrompt(agent: AgentDefinition, state: AgentState): string {
  const basePrompt = `You are ${agent.name}, a specialized AI agent in the HELIOS clinical triage system.

Your role: ${agent.description}
Team: ${agent.team}
Tier: ${agent.tier}

You can consult with these agents if needed: ${agent.canConsult.join(', ')}
${agent.reportsTo ? `You report to: ${agent.reportsTo}` : ''}

Current session language: ${state.language}
Current phase: ${state.currentPhase}

CRITICAL RULES:
1. Never provide medical diagnoses - only gather information and assess urgency
2. Always recommend consulting a healthcare provider
3. Escalate immediately if you detect safety concerns
4. Be empathetic and use appropriate language for the patient's language preference
5. Document your reasoning clearly

Output your response in JSON format with:
{
  "reasoning": "Your step-by-step thinking",
  "content": "Response to share with the patient (if applicable)",
  "extractedData": { ... },
  "confidence": 0.0-1.0,
  "consultationsNeeded": ["agent_id", ...],
  "safetyFlags": [{ "ruleId": "...", "description": "..." }, ...],
  "recommendedNextAgent": "agent_id or null"
}`;

  return basePrompt;
}

function gatherPreviousContext(
  state: AgentState,
  agent: AgentDefinition
): Record<string, unknown> {
  const context: Record<string, unknown> = {};

  // Get outputs from agents we can consult
  for (const consultableId of agent.canConsult) {
    const output = state.agentOutputs.get(consultableId);
    if (output) {
      context[consultableId] = {
        content: output.content,
        structuredData: output.structuredData,
        confidence: output.confidence,
      };
    }
  }

  return context;
}

async function performRequiredConsultations(
  agent: AgentDefinition,
  bus: AgentCommunicationBus,
  state: AgentState,
  previousContext: Record<string, unknown>
): Promise<ConsultationResult[]> {
  const results: ConsultationResult[] = [];

  // Determine which agents need to be consulted
  // This is based on the current phase and what data is available
  const consultationsNeeded = determineNeededConsultations(agent, state, previousContext);

  for (const targetAgentId of consultationsNeeded) {
    try {
      const result = await bus.consultAgent(
        targetAgentId,
        `Requesting consultation for session ${state.sessionId}`,
        { caseData: state.caseData, phase: state.currentPhase }
      );
      results.push(result);
    } catch (error) {
      console.error(`Consultation with ${targetAgentId} failed:`, error);
    }
  }

  return results;
}

function determineNeededConsultations(
  agent: AgentDefinition,
  state: AgentState,
  previousContext: Record<string, unknown>
): string[] {
  const needed: string[] = [];

  // Safety agents should always be consulted for triage decisions
  if (agent.team === 'triage' || agent.team === 'differential') {
    if (!previousContext['safety_chief']) {
      needed.push('safety_chief');
    }
  }

  // Differential agents should consult knowledge agents
  if (agent.team === 'differential' && agent.tier === 'specialist') {
    if (!previousContext['knowledge_chief']) {
      needed.push('knowledge_chief');
    }
  }

  return needed.filter(id => agent.canConsult.includes(id));
}

function buildAgentPrompt(
  agent: AgentDefinition,
  state: AgentState,
  consultations: ConsultationResult[]
): string {
  let prompt = `
Current case data:
${JSON.stringify(state.caseData, null, 2)}

Latest messages:
${state.messages.slice(-5).map(m => `${m._getType()}: ${m.content}`).join('\n')}
`;

  if (consultations.length > 0) {
    prompt += `
Consultation results:
${consultations.map(c => `
- ${c.consultedAgent}: ${c.response} (confidence: ${c.confidence})
`).join('\n')}
`;
  }

  prompt += `
Please provide your analysis and recommendations.
`;

  return prompt;
}

function parseAgentResponse(
  _agent: AgentDefinition,
  response: string
): Record<string, unknown> {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('Failed to parse agent response as JSON:', error);
  }

  return {
    content: response,
    confidence: 0.5,
  };
}

function determineNextAgent(
  agent: AgentDefinition,
  output: Record<string, unknown>,
  _state: AgentState
): string | undefined {
  // If agent specified a next agent
  if (output.recommendedNextAgent) {
    return output.recommendedNextAgent as string;
  }

  // If safety flags, go to safety chief
  if ((output.safetyFlags as unknown[])?.length > 0) {
    return 'safety_chief';
  }

  // Default to supervisor if this is a worker/specialist
  if (agent.tier !== 'supervisor' && agent.reportsTo) {
    return agent.reportsTo;
  }

  return undefined;
}

function checkForSafetyFlags(
  agent: AgentDefinition,
  output: Record<string, unknown>,
  _state: AgentState
): SafetyFlag[] {
  const flags: SafetyFlag[] = [];

  if (output.safetyFlags && Array.isArray(output.safetyFlags)) {
    for (const flag of output.safetyFlags as Array<{ ruleId?: string; severity?: string; description?: string }>) {
      flags.push({
        ruleId: flag.ruleId || 'unknown',
        severity: (flag.severity as 'critical' | 'high' | 'moderate') || 'moderate',
        description: flag.description || '',
        detectedBy: agent.id,
        timestamp: Date.now(),
      });
    }
  }

  return flags;
}

function buildSupervisorPrompt(supervisor: AgentDefinition, state: AgentState): string {
  return `You are ${supervisor.name}, the supervisor of the ${supervisor.team} team.

Your subordinates are: ${supervisor.supervises?.join(', ')}

Your job is to:
1. Review outputs from your team members
2. Resolve any conflicts or disagreements
3. Build consensus when needed
4. Make final team recommendations
5. Escalate to your supervisor if needed: ${supervisor.reportsTo || 'N/A'}

Current session: ${state.sessionId}
Language: ${state.language}
Phase: ${state.currentPhase}

Provide your supervisory analysis in JSON:
{
  "teamAssessment": "Your overall assessment of team outputs",
  "conflicts": [{ "topic": "...", "positions": [...] }],
  "resolution": "How you resolved any conflicts",
  "finalRecommendation": "Your team's consolidated recommendation",
  "requiresConsensus": true/false,
  "consensusTopic": "If consensus needed, the topic",
  "nextAgent": "Recommended next agent",
  "nextAgentIfConsensus": "If consensus achieved",
  "nextAgentIfNoConsensus": "If consensus not achieved",
  "escalationNeeded": true/false,
  "escalationReason": "If escalating, why"
}`;
}

function parseSupervisorDecision(response: string): {
  requiresConsensus: boolean;
  consensusTopic?: string;
  nextAgent?: string;
  nextAgentIfConsensus?: string;
  nextAgentIfNoConsensus?: string;
} {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('Failed to parse supervisor decision:', error);
  }

  return { requiresConsensus: false };
}

async function collectConsensusVotes(
  supervisor: AgentDefinition,
  bus: AgentCommunicationBus,
  topic: string,
  state: AgentState
): Promise<ConsensusVote[]> {
  const votes: ConsensusVote[] = [];

  // Request votes from subordinates
  for (const subordinateId of supervisor.supervises || []) {
    try {
      const result = await bus.consultAgent(
        subordinateId,
        `Please vote on: ${topic}`,
        { topic, caseData: state.caseData },
        10000 // 10 second timeout for votes
      );

      // Parse vote from response
      const voteMatch = result.response.match(/(agree|disagree|abstain)/i);
      votes.push({
        agentId: subordinateId,
        topic,
        vote: (voteMatch?.[1]?.toLowerCase() as 'agree' | 'disagree' | 'abstain') || 'abstain',
        reasoning: result.response,
        confidence: result.confidence,
      });
    } catch (error) {
      // If agent doesn't respond, count as abstain
      votes.push({
        agentId: subordinateId,
        topic,
        vote: 'abstain',
        reasoning: 'No response received',
        confidence: 0,
      });
    }
  }

  return votes;
}

function evaluateConsensus(votes: ConsensusVote[]): {
  achieved: boolean;
  agreementPercentage: number;
} {
  const nonAbstainVotes = votes.filter(v => v.vote !== 'abstain');
  if (nonAbstainVotes.length === 0) {
    return { achieved: false, agreementPercentage: 0 };
  }

  const agreeVotes = nonAbstainVotes.filter(v => v.vote === 'agree');
  const agreementPercentage = agreeVotes.length / nonAbstainVotes.length;

  return {
    achieved: agreementPercentage >= 0.7,
    agreementPercentage,
  };
}
