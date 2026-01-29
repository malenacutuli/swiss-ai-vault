/**
 * Consensus Building System
 * Enables agents to vote and reach agreement on clinical decisions
 */

import { AGENT_MODELS } from './setup';
import { getAgentById } from './taxonomy';

export interface ConsensusRequest {
  topic: string;
  context: Record<string, unknown>;
  options?: string[];
  requiredVoters: string[];
  minimumVotes: number;
  threshold: number; // Percentage needed for consensus (e.g., 0.7 = 70%)
  timeoutMs: number;
}

export interface ConsensusVote {
  agentId: string;
  agentName: string;
  vote: string | 'abstain';
  confidence: number;
  reasoning: string;
  timestamp: number;
}

export interface ConsensusResult {
  achieved: boolean;
  winningOption?: string;
  voteCount: Record<string, number>;
  weightedScores: Record<string, number>;
  votes: ConsensusVote[];
  dissent: ConsensusVote[];
  summary: string;
}

/**
 * Differential Diagnosis Consensus
 * Multiple specialist agents vote on most likely diagnoses
 */
export async function buildDifferentialConsensus(
  sessionId: string,
  symptoms: string[],
  caseData: Record<string, unknown>,
  language: string
): Promise<ConsensusResult> {
  // Get relevant differential agents
  const diffAgents = [
    'diff_hypothesis',
    'diff_evidence',
    'diff_mustnotmiss',
    'diff_cardio',
    'diff_pulm',
    'diff_gi',
    'diff_neuro',
  ].filter(id => {
    // Only include specialty agents if symptoms match their domain
    if (id.includes('cardio') && !hasCardiacSymptoms(symptoms)) return false;
    if (id.includes('pulm') && !hasPulmonarySymptoms(symptoms)) return false;
    if (id.includes('gi') && !hasGISymptoms(symptoms)) return false;
    if (id.includes('neuro') && !hasNeuroSymptoms(symptoms)) return false;
    return true;
  });

  const request: ConsensusRequest = {
    topic: 'differential_diagnosis',
    context: {
      symptoms,
      caseData,
      language,
    },
    requiredVoters: diffAgents,
    minimumVotes: Math.ceil(diffAgents.length * 0.6),
    threshold: 0.7,
    timeoutMs: 30000,
  };

  return await runConsensusProcess(sessionId, request);
}

/**
 * Triage Level Consensus
 * Multiple agents vote on ESI level
 */
export async function buildTriageConsensus(
  sessionId: string,
  caseData: Record<string, unknown>
): Promise<ConsensusResult> {
  const triageAgents = [
    'triage_esi',
    'triage_acuity',
    'triage_disposition',
  ];

  // Add specialty agents if relevant
  if (caseData.patientAge && (caseData.patientAge as number) < 18) {
    triageAgents.push('triage_pediatric');
  }
  if (caseData.patientAge && (caseData.patientAge as number) > 65) {
    triageAgents.push('triage_geriatric');
  }
  if (caseData.pregnant) {
    triageAgents.push('triage_ob');
  }

  const request: ConsensusRequest = {
    topic: 'triage_level',
    context: caseData,
    options: ['ESI1', 'ESI2', 'ESI3', 'ESI4', 'ESI5'],
    requiredVoters: triageAgents,
    minimumVotes: 2,
    threshold: 0.6, // Lower threshold for triage - err on side of caution
    timeoutMs: 20000,
  };

  return await runConsensusProcess(sessionId, request);
}

/**
 * Safety Consensus
 * All safety agents must agree on red flags
 */
export async function buildSafetyConsensus(
  sessionId: string,
  potentialRedFlags: string[],
  caseData: Record<string, unknown>
): Promise<ConsensusResult> {
  const safetyAgents = [
    'safety_chief',
    'safety_cardiac',
    'safety_neuro',
    'safety_resp',
  ];

  // Safety requires higher threshold
  const request: ConsensusRequest = {
    topic: 'safety_flags',
    context: {
      potentialRedFlags,
      ...caseData,
    },
    options: potentialRedFlags,
    requiredVoters: safetyAgents,
    minimumVotes: safetyAgents.length, // All must vote
    threshold: 0.5, // If ANY agent flags, it counts (lower threshold)
    timeoutMs: 15000,
  };

  return await runConsensusProcess(sessionId, request);
}

/**
 * Main consensus process
 */
async function runConsensusProcess(
  sessionId: string,
  request: ConsensusRequest
): Promise<ConsensusResult> {
  const model = AGENT_MODELS.ORCHESTRATION;
  const votes: ConsensusVote[] = [];

  // Collect votes from all required voters in parallel
  const votePromises = request.requiredVoters.map(async (agentId) => {
    const agent = getAgentById(agentId);
    if (!agent) return null;

    try {
      const prompt = buildVotePrompt(request, agent);
      const response = await model.invoke([
        { role: 'system', content: getAgentVotingPrompt(agent) },
        { role: 'user', content: prompt },
      ]);

      return parseVote(agentId, agent.name, response.content as string);
    } catch (error) {
      console.error(`Vote collection failed for ${agentId}:`, error);
      return {
        agentId,
        agentName: agent.name,
        vote: 'abstain',
        confidence: 0,
        reasoning: 'Failed to respond',
        timestamp: Date.now(),
      };
    }
  });

  const collectedVotes = await Promise.all(votePromises);
  votes.push(...collectedVotes.filter((v): v is ConsensusVote => v !== null));

  // Evaluate consensus
  return evaluateConsensus(request, votes);
}

interface AgentInfo {
  name: string;
  description: string;
}

function buildVotePrompt(request: ConsensusRequest, agent: AgentInfo): string {
  return `
CONSENSUS VOTE REQUEST

Topic: ${request.topic}
Context: ${JSON.stringify(request.context, null, 2)}
${request.options ? `Options: ${request.options.join(', ')}` : ''}

As ${agent.name}, please provide your vote:

1. Your recommendation (${request.options ? 'choose from options' : 'your assessment'})
2. Your confidence level (0.0-1.0)
3. Your reasoning

Respond in JSON:
{
  "vote": "your_choice",
  "confidence": 0.0-1.0,
  "reasoning": "why you chose this"
}
`;
}

function getAgentVotingPrompt(agent: AgentInfo): string {
  return `You are ${agent.name}, specialized in ${agent.description}.
When voting, consider:
- Your specific area of expertise
- The evidence available
- Potential risks if you're wrong
- The principle of "first do no harm"

Be precise and justify your vote clearly.`;
}

function parseVote(agentId: string, agentName: string, response: string): ConsensusVote {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        agentId,
        agentName,
        vote: parsed.vote || 'abstain',
        confidence: parsed.confidence || 0.5,
        reasoning: parsed.reasoning || '',
        timestamp: Date.now(),
      };
    }
  } catch (error) {
    console.error('Failed to parse vote:', error);
  }

  return {
    agentId,
    agentName,
    vote: 'abstain',
    confidence: 0,
    reasoning: 'Failed to parse response',
    timestamp: Date.now(),
  };
}

function evaluateConsensus(
  request: ConsensusRequest,
  votes: ConsensusVote[]
): ConsensusResult {
  // Count votes
  const voteCount: Record<string, number> = {};
  const weightedScores: Record<string, number> = {};
  const dissent: ConsensusVote[] = [];

  // Non-abstain votes
  const activeVotes = votes.filter(v => v.vote !== 'abstain');

  // Check if we have enough votes
  if (activeVotes.length < request.minimumVotes) {
    return {
      achieved: false,
      voteCount: {},
      weightedScores: {},
      votes,
      dissent: [],
      summary: `Insufficient votes: ${activeVotes.length}/${request.minimumVotes} required`,
    };
  }

  // Tally votes
  for (const vote of activeVotes) {
    if (!voteCount[vote.vote]) {
      voteCount[vote.vote] = 0;
      weightedScores[vote.vote] = 0;
    }
    voteCount[vote.vote]++;
    weightedScores[vote.vote] += vote.confidence;
  }

  // Find winner
  let winningOption: string | undefined;
  let maxScore = 0;

  for (const [option, score] of Object.entries(weightedScores)) {
    if (score > maxScore) {
      maxScore = score;
      winningOption = option;
    }
  }

  // Calculate agreement percentage
  const totalVotes = activeVotes.length;
  const winningVotes = winningOption ? voteCount[winningOption] : 0;
  const agreementPercentage = winningVotes / totalVotes;

  // Consensus achieved if meets threshold
  const achieved = agreementPercentage >= request.threshold;

  // Identify dissenting votes
  if (winningOption) {
    dissent.push(...activeVotes.filter(v => v.vote !== winningOption));
  }

  return {
    achieved,
    winningOption: achieved ? winningOption : undefined,
    voteCount,
    weightedScores,
    votes,
    dissent,
    summary: achieved
      ? `Consensus achieved: ${winningOption} (${(agreementPercentage * 100).toFixed(0)}% agreement)`
      : `No consensus: highest was ${winningOption} with ${(agreementPercentage * 100).toFixed(0)}% agreement (threshold: ${request.threshold * 100}%)`,
  };
}

// Helper functions to determine relevant specialists
function hasCardiacSymptoms(symptoms: string[]): boolean {
  const cardiacKeywords = ['chest pain', 'palpitations', 'shortness of breath', 'edema', 'dizziness'];
  return symptoms.some(s => cardiacKeywords.some(k => s.toLowerCase().includes(k)));
}

function hasPulmonarySymptoms(symptoms: string[]): boolean {
  const pulmonaryKeywords = ['cough', 'wheezing', 'shortness of breath', 'hemoptysis', 'dyspnea'];
  return symptoms.some(s => pulmonaryKeywords.some(k => s.toLowerCase().includes(k)));
}

function hasGISymptoms(symptoms: string[]): boolean {
  const giKeywords = ['abdominal pain', 'nausea', 'vomiting', 'diarrhea', 'constipation', 'blood in stool'];
  return symptoms.some(s => giKeywords.some(k => s.toLowerCase().includes(k)));
}

function hasNeuroSymptoms(symptoms: string[]): boolean {
  const neuroKeywords = ['headache', 'numbness', 'tingling', 'weakness', 'confusion', 'seizure', 'vision changes'];
  return symptoms.some(s => neuroKeywords.some(k => s.toLowerCase().includes(k)));
}
