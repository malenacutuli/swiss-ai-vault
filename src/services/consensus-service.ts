/**
 * HELIOS Grand Rounds - Multi-Agent Consensus Service
 *
 * Implements consensus algorithms for aggregating opinions from
 * multiple specialist agents in the Grand Rounds debate protocol.
 *
 * Key algorithms:
 * - Kendall's W coefficient of concordance
 * - Confidence-weighted voting
 * - Discordance detection
 * - Consensus matrix analysis
 */

import type {
  AgentOpinion,
  DifferentialDiagnosis,
  ConsensusResult,
  ICD10Code,
} from '@/types/medical-triage';
import type { SpecialistConfig } from '@/config/grand-rounds-agents';

// ============================================
// TYPES
// ============================================

/**
 * Structured consensus matrix for analysis
 */
export interface ConsensusMatrix {
  /** Agent IDs in row order */
  agents: string[];
  /** Diagnosis names/codes in column order */
  diagnoses: string[];
  /** Raw preference matrix (agents × diagnoses) */
  matrix: number[][];
  /** Row-normalized matrix (each agent's preferences sum to 1) */
  normalizedMatrix: number[][];
  /** Agent weights based on symptom relevance */
  weights: Record<string, number>;
  /** Column aggregates (weighted sum per diagnosis) */
  aggregatedScores: number[];
  /** Confidence values per agent */
  confidences: Record<string, number>;
}

/**
 * Disagreement analysis result
 */
export interface DisagreementAnalysis {
  /** Overall disagreement score (0-1) */
  score: number;
  /** Interpretation level */
  level: 'minor' | 'moderate' | 'major';
  /** Discordant agents that deviate significantly */
  discordantAgents: string[];
  /** Recommendation for next action */
  recommendation: 'proceed' | 'additional_round' | 'human_review';
  /** Specific areas of disagreement */
  contentionPoints: string[];
}

/**
 * Ranking data for Kendall's W calculation
 */
export interface RankingData {
  agentId: string;
  rankings: Map<string, number>; // diagnosis -> rank (1 = highest)
}

// ============================================
// KENDALL'S W COEFFICIENT
// ============================================

/**
 * Compute Kendall's W coefficient of concordance
 *
 * Measures agreement among N agents ranking K diagnoses.
 * W = 1 indicates perfect agreement, W = 0 indicates no agreement.
 *
 * Formula: W = 12 * S / (N² * (K³ - K))
 * where S = Σ(R_j - R̄)² (sum of squared deviations from mean rank)
 *
 * @param rankings - N × K matrix where rankings[i][j] is agent i's rank for diagnosis j
 * @returns W coefficient in range [0, 1]
 */
export function computeKendallW(rankings: number[][]): number {
  const N = rankings.length; // Number of agents
  if (N < 2) return 1; // Perfect agreement with single agent

  const K = rankings[0]?.length || 0; // Number of diagnoses
  if (K < 2) return 1; // Perfect agreement with single diagnosis

  // Verify all rows have same length
  if (!rankings.every(row => row.length === K)) {
    console.warn('[Consensus] Inconsistent ranking lengths, using minimum');
  }

  // Calculate sum of ranks for each diagnosis (column sums)
  const R: number[] = new Array(K).fill(0);
  for (let j = 0; j < K; j++) {
    for (let i = 0; i < N; i++) {
      R[j] += rankings[i][j] || 0;
    }
  }

  // Calculate mean rank sum
  const R_bar = R.reduce((sum, r) => sum + r, 0) / K;

  // Calculate S (sum of squared deviations)
  let S = 0;
  for (let j = 0; j < K; j++) {
    S += Math.pow(R[j] - R_bar, 2);
  }

  // Calculate W
  const denominator = N * N * (K * K * K - K);
  if (denominator === 0) return 1;

  const W = (12 * S) / denominator;

  // Clamp to [0, 1] to handle floating point errors
  return Math.max(0, Math.min(1, W));
}

/**
 * Convert agent opinions to ranking matrix for Kendall's W
 *
 * @param opinions - Array of agent opinions with differential diagnoses
 * @returns Ranking matrix (agents × diagnoses)
 */
export function opinionsToRankingMatrix(opinions: AgentOpinion[]): {
  matrix: number[][];
  diagnoses: string[];
  agents: string[];
} {
  if (opinions.length === 0) {
    return { matrix: [], diagnoses: [], agents: [] };
  }

  // Collect all unique diagnoses across all opinions
  const allDiagnoses = new Set<string>();
  for (const opinion of opinions) {
    for (const dx of opinion.differentialDiagnosis) {
      allDiagnoses.add(dx.icd10?.code || dx.diagnosis);
    }
  }

  const diagnoses = Array.from(allDiagnoses);
  const agents = opinions.map(o => o.agentId);

  // Build ranking matrix
  const matrix: number[][] = [];

  for (const opinion of opinions) {
    const row: number[] = new Array(diagnoses.length).fill(diagnoses.length + 1); // Default to worst rank

    for (const dx of opinion.differentialDiagnosis) {
      const diagKey = dx.icd10?.code || dx.diagnosis;
      const diagIndex = diagnoses.indexOf(diagKey);
      if (diagIndex >= 0) {
        row[diagIndex] = dx.rank;
      }
    }

    matrix.push(row);
  }

  return { matrix, diagnoses, agents };
}

/**
 * Compute Kendall's W directly from agent opinions
 */
export function computeKendallWFromOpinions(opinions: AgentOpinion[]): number {
  const { matrix } = opinionsToRankingMatrix(opinions);
  return computeKendallW(matrix);
}

// ============================================
// CONFIDENCE-WEIGHTED VOTING
// ============================================

/**
 * Compute weighted vote score for an agent's opinion
 *
 * Weight = confidence * (1 / (1 + log(1 + concerns.length)))
 *
 * Higher confidence increases weight, more concerns decrease it.
 */
function computeVoteWeight(opinion: AgentOpinion): number {
  const confidence = opinion.confidenceScore || 0.5;
  const concernCount = opinion.concerns?.length || 0;

  // Concern penalty: more concerns reduce weight
  const concernPenalty = 1 / (1 + Math.log(1 + concernCount));

  return confidence * concernPenalty;
}

/**
 * Aggregate opinions using confidence-weighted voting
 *
 * Each agent's vote is weighted by their confidence and concern level.
 * Returns diagnoses ranked by weighted aggregate score.
 *
 * @param opinions - Array of agent opinions
 * @returns Ranked differential diagnosis list
 */
export function confidenceWeightedVote(opinions: AgentOpinion[]): DifferentialDiagnosis[] {
  if (opinions.length === 0) return [];

  // Aggregate scores per diagnosis
  const diagnosisScores = new Map<
    string,
    {
      diagnosis: string;
      icd10: ICD10Code | null;
      totalScore: number;
      totalWeight: number;
      supportingEvidence: Set<string>;
      refutingEvidence: Set<string>;
      reasonings: string[];
      mustNotMiss: boolean;
      urgencies: Set<string>;
    }
  >();

  for (const opinion of opinions) {
    const weight = computeVoteWeight(opinion);

    for (const dx of opinion.differentialDiagnosis) {
      const key = dx.icd10?.code || dx.diagnosis;

      if (!diagnosisScores.has(key)) {
        diagnosisScores.set(key, {
          diagnosis: dx.diagnosis,
          icd10: dx.icd10,
          totalScore: 0,
          totalWeight: 0,
          supportingEvidence: new Set(),
          refutingEvidence: new Set(),
          reasonings: [],
          mustNotMiss: false,
          urgencies: new Set(),
        });
      }

      const entry = diagnosisScores.get(key)!;

      // Score based on rank (higher rank = higher score)
      // Convert rank to score: if rank=1 out of 5, score = 5; rank=5, score = 1
      const maxRank = opinion.differentialDiagnosis.length;
      const rankScore = maxRank - dx.rank + 1;

      entry.totalScore += rankScore * weight * dx.confidence;
      entry.totalWeight += weight;

      // Merge evidence
      dx.supportingEvidence?.forEach(e => entry.supportingEvidence.add(e));
      dx.refutingEvidence?.forEach(e => entry.refutingEvidence.add(e));

      if (dx.reasoning) entry.reasonings.push(dx.reasoning);
      if (dx.mustNotMiss) entry.mustNotMiss = true;
      if (dx.urgency) entry.urgencies.add(dx.urgency);
    }
  }

  // Convert to ranked list
  const results: DifferentialDiagnosis[] = [];

  for (const [, entry] of diagnosisScores) {
    const avgScore = entry.totalWeight > 0 ? entry.totalScore / entry.totalWeight : 0;

    // Determine most urgent urgency level
    let urgency: 'emergent' | 'urgent' | 'routine' | undefined;
    if (entry.urgencies.has('emergent')) urgency = 'emergent';
    else if (entry.urgencies.has('urgent')) urgency = 'urgent';
    else if (entry.urgencies.has('routine')) urgency = 'routine';

    results.push({
      rank: 0, // Will be assigned after sorting
      diagnosis: entry.diagnosis,
      icd10: entry.icd10 || {
        code: 'UNVALIDATED',
        name: entry.diagnosis,
        confidence: 0,
        validated: false,
      },
      confidence: Math.min(1, avgScore), // Normalize to 0-1
      reasoning: entry.reasonings.join(' '),
      supportingEvidence: Array.from(entry.supportingEvidence),
      refutingEvidence:
        entry.refutingEvidence.size > 0 ? Array.from(entry.refutingEvidence) : undefined,
      mustNotMiss: entry.mustNotMiss,
      urgency,
    });
  }

  // Sort by confidence descending and assign ranks
  results.sort((a, b) => b.confidence - a.confidence);
  results.forEach((dx, index) => {
    dx.rank = index + 1;
  });

  return results;
}

// ============================================
// AGENT WEIGHT COMPUTATION
// ============================================

/**
 * Compute relevance-based weights for each specialist
 *
 * Weights are based on how relevant each specialist's symptom weights
 * are to the presenting symptoms.
 *
 * @param symptoms - Patient's presenting symptoms
 * @param specialists - Specialist configurations
 * @returns Normalized weights (sum to 1.0)
 */
export function computeAgentWeights(
  symptoms: string[],
  specialists: SpecialistConfig[]
): Record<string, number> {
  if (specialists.length === 0) return {};

  const normalizedSymptoms = symptoms.map(s => s.toLowerCase().trim());
  const rawWeights: Record<string, number> = {};

  for (const specialist of specialists) {
    let score = 0;

    // Sum symptom weights for matching symptoms
    for (const symptom of normalizedSymptoms) {
      // Direct match
      if (specialist.symptomWeights[symptom]) {
        score += specialist.symptomWeights[symptom];
        continue;
      }

      // Partial match
      for (const [keyword, weight] of Object.entries(specialist.symptomWeights)) {
        if (symptom.includes(keyword) || keyword.includes(symptom)) {
          score += weight * 0.7; // Partial match penalty
          break;
        }
      }
    }

    // Always-include specialists get minimum weight
    if (specialist.alwaysInclude && score < 0.5) {
      score = 0.5;
    }

    rawWeights[specialist.id] = score;
  }

  // Normalize to sum to 1.0
  const totalWeight = Object.values(rawWeights).reduce((sum, w) => sum + w, 0);

  const normalizedWeights: Record<string, number> = {};
  for (const [id, weight] of Object.entries(rawWeights)) {
    normalizedWeights[id] = totalWeight > 0 ? weight / totalWeight : 1 / specialists.length;
  }

  return normalizedWeights;
}

// ============================================
// DISCORDANCE DETECTION
// ============================================

/**
 * Compute preference vector for an agent
 *
 * Returns normalized confidence scores for each diagnosis they mentioned
 */
function computePreferenceVector(
  opinion: AgentOpinion,
  allDiagnoses: string[]
): number[] {
  const vector = new Array(allDiagnoses.length).fill(0);

  for (const dx of opinion.differentialDiagnosis) {
    const key = dx.icd10?.code || dx.diagnosis;
    const index = allDiagnoses.indexOf(key);
    if (index >= 0) {
      vector[index] = dx.confidence;
    }
  }

  // Normalize
  const sum = vector.reduce((s, v) => s + v, 0);
  if (sum > 0) {
    return vector.map(v => v / sum);
  }

  return vector;
}

/**
 * Compute mean preference vector across all agents
 */
function computeMeanPreferenceVector(opinions: AgentOpinion[]): {
  mean: number[];
  diagnoses: string[];
} {
  // Collect all diagnoses
  const allDiagnoses = new Set<string>();
  for (const opinion of opinions) {
    for (const dx of opinion.differentialDiagnosis) {
      allDiagnoses.add(dx.icd10?.code || dx.diagnosis);
    }
  }

  const diagnoses = Array.from(allDiagnoses);
  const vectors = opinions.map(o => computePreferenceVector(o, diagnoses));

  // Compute mean
  const mean = new Array(diagnoses.length).fill(0);
  for (const vector of vectors) {
    for (let i = 0; i < vector.length; i++) {
      mean[i] += vector[i] / vectors.length;
    }
  }

  return { mean, diagnoses };
}

/**
 * Compute Euclidean distance between two vectors
 */
function euclideanDistance(v1: number[], v2: number[]): number {
  if (v1.length !== v2.length) return Infinity;

  let sum = 0;
  for (let i = 0; i < v1.length; i++) {
    sum += Math.pow(v1[i] - v2[i], 2);
  }

  return Math.sqrt(sum);
}

/**
 * Identify agents whose opinions deviate significantly from consensus
 *
 * Returns agents where deviation > mean + threshold * std
 *
 * @param opinions - All agent opinions
 * @param threshold - Number of standard deviations for discordance (default: 1.5)
 * @returns Discordant agent opinions
 */
export function identifyDiscordantAgents(
  opinions: AgentOpinion[],
  threshold = 1.5
): AgentOpinion[] {
  if (opinions.length < 3) return []; // Need at least 3 to identify outliers

  const { mean, diagnoses } = computeMeanPreferenceVector(opinions);

  // Compute deviation for each agent
  const deviations: { opinion: AgentOpinion; deviation: number }[] = [];

  for (const opinion of opinions) {
    const vector = computePreferenceVector(opinion, diagnoses);
    const deviation = euclideanDistance(vector, mean);
    deviations.push({ opinion, deviation });
  }

  // Compute mean and std of deviations
  const deviationValues = deviations.map(d => d.deviation);
  const meanDeviation = deviationValues.reduce((s, d) => s + d, 0) / deviationValues.length;

  const variance =
    deviationValues.reduce((s, d) => s + Math.pow(d - meanDeviation, 2), 0) /
    deviationValues.length;
  const stdDeviation = Math.sqrt(variance);

  // Identify discordant agents
  const discordanceThreshold = meanDeviation + threshold * stdDeviation;

  return deviations
    .filter(d => d.deviation > discordanceThreshold)
    .map(d => d.opinion);
}

/**
 * Measure overall disagreement among agents
 *
 * Returns a score from 0 (perfect agreement) to 1 (complete disagreement)
 *
 * @param opinions - All agent opinions
 * @returns Disagreement score
 */
export function measureDisagreement(opinions: AgentOpinion[]): number {
  if (opinions.length < 2) return 0; // Perfect agreement with single agent

  // Method 1: Kendall's W inversion
  const kendallW = computeKendallWFromOpinions(opinions);
  const kendallDisagreement = 1 - kendallW;

  // Method 2: Average pairwise preference distance
  const { mean, diagnoses } = computeMeanPreferenceVector(opinions);
  const vectors = opinions.map(o => computePreferenceVector(o, diagnoses));

  let totalDistance = 0;
  let pairCount = 0;

  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      totalDistance += euclideanDistance(vectors[i], vectors[j]);
      pairCount++;
    }
  }

  const avgDistance = pairCount > 0 ? totalDistance / pairCount : 0;
  // Normalize distance to 0-1 (max possible distance with normalized vectors is sqrt(2))
  const distanceDisagreement = Math.min(1, avgDistance / Math.sqrt(2));

  // Method 3: Confidence variance
  const confidences = opinions.map(o => o.confidenceScore || 0.5);
  const meanConfidence = confidences.reduce((s, c) => s + c, 0) / confidences.length;
  const confidenceVariance =
    confidences.reduce((s, c) => s + Math.pow(c - meanConfidence, 2), 0) / confidences.length;
  // High variance in confidence indicates disagreement about certainty
  const confidenceDisagreement = Math.min(1, confidenceVariance * 4); // Scale factor

  // Combine methods with weights
  const disagreement =
    kendallDisagreement * 0.5 + distanceDisagreement * 0.35 + confidenceDisagreement * 0.15;

  return Math.max(0, Math.min(1, disagreement));
}

/**
 * Analyze disagreement and provide recommendations
 *
 * @param opinions - All agent opinions
 * @returns Full disagreement analysis
 */
export function analyzeDisagreement(opinions: AgentOpinion[]): DisagreementAnalysis {
  const score = measureDisagreement(opinions);
  const discordantAgents = identifyDiscordantAgents(opinions);

  // Determine level and recommendation
  let level: 'minor' | 'moderate' | 'major';
  let recommendation: 'proceed' | 'additional_round' | 'human_review';

  if (score < 0.3) {
    level = 'minor';
    recommendation = 'proceed';
  } else if (score < 0.6) {
    level = 'moderate';
    recommendation = 'additional_round';
  } else {
    level = 'major';
    recommendation = 'human_review';
  }

  // Identify contention points (diagnoses with high variance in ranking)
  const contentionPoints: string[] = [];
  const { diagnoses } = computeMeanPreferenceVector(opinions);

  for (const diagnosis of diagnoses) {
    const ranks: number[] = [];

    for (const opinion of opinions) {
      const dx = opinion.differentialDiagnosis.find(
        d => (d.icd10?.code || d.diagnosis) === diagnosis
      );
      if (dx) {
        ranks.push(dx.rank);
      }
    }

    if (ranks.length >= 2) {
      const meanRank = ranks.reduce((s, r) => s + r, 0) / ranks.length;
      const variance =
        ranks.reduce((s, r) => s + Math.pow(r - meanRank, 2), 0) / ranks.length;

      // High variance = contention
      if (variance > 2) {
        contentionPoints.push(diagnosis);
      }
    }
  }

  return {
    score,
    level,
    discordantAgents: discordantAgents.map(o => o.agentId),
    recommendation,
    contentionPoints,
  };
}

// ============================================
// CONSENSUS MATRIX BUILDER
// ============================================

/**
 * Build a structured consensus matrix from agent opinions
 *
 * The matrix enables analysis of voting patterns and weighted aggregation.
 *
 * @param opinions - All agent opinions
 * @param agentWeights - Optional pre-computed agent weights
 * @returns Structured consensus matrix
 */
export function buildConsensusMatrix(
  opinions: AgentOpinion[],
  agentWeights?: Record<string, number>
): ConsensusMatrix {
  if (opinions.length === 0) {
    return {
      agents: [],
      diagnoses: [],
      matrix: [],
      normalizedMatrix: [],
      weights: {},
      aggregatedScores: [],
      confidences: {},
    };
  }

  // Collect all diagnoses
  const diagnosisSet = new Set<string>();
  for (const opinion of opinions) {
    for (const dx of opinion.differentialDiagnosis) {
      diagnosisSet.add(dx.icd10?.code || dx.diagnosis);
    }
  }

  const diagnoses = Array.from(diagnosisSet);
  const agents = opinions.map(o => o.agentId);

  // Build raw preference matrix
  // matrix[i][j] = agent i's confidence in diagnosis j
  const matrix: number[][] = [];
  const confidences: Record<string, number> = {};

  for (const opinion of opinions) {
    const row = new Array(diagnoses.length).fill(0);

    for (const dx of opinion.differentialDiagnosis) {
      const key = dx.icd10?.code || dx.diagnosis;
      const index = diagnoses.indexOf(key);
      if (index >= 0) {
        row[index] = dx.confidence;
      }
    }

    matrix.push(row);
    confidences[opinion.agentId] = opinion.confidenceScore || 0.5;
  }

  // Normalize each row (agent preferences sum to 1)
  const normalizedMatrix: number[][] = [];

  for (const row of matrix) {
    const sum = row.reduce((s, v) => s + v, 0);
    if (sum > 0) {
      normalizedMatrix.push(row.map(v => v / sum));
    } else {
      normalizedMatrix.push(new Array(diagnoses.length).fill(1 / diagnoses.length));
    }
  }

  // Use provided weights or compute vote weights
  const weights: Record<string, number> = agentWeights || {};
  if (Object.keys(weights).length === 0) {
    for (const opinion of opinions) {
      weights[opinion.agentId] = computeVoteWeight(opinion);
    }

    // Normalize weights
    const totalWeight = Object.values(weights).reduce((s, w) => s + w, 0);
    for (const id of Object.keys(weights)) {
      weights[id] = totalWeight > 0 ? weights[id] / totalWeight : 1 / agents.length;
    }
  }

  // Compute aggregated scores (weighted sum per diagnosis)
  const aggregatedScores = new Array(diagnoses.length).fill(0);

  for (let j = 0; j < diagnoses.length; j++) {
    for (let i = 0; i < agents.length; i++) {
      const agentWeight = weights[agents[i]] || 1 / agents.length;
      const agentConfidence = confidences[agents[i]] || 0.5;

      // Apply confidence weighting and concern penalty from normalized preferences
      aggregatedScores[j] += normalizedMatrix[i][j] * agentWeight * agentConfidence;
    }
  }

  return {
    agents,
    diagnoses,
    matrix,
    normalizedMatrix,
    weights,
    aggregatedScores,
    confidences,
  };
}

// ============================================
// CONSENSUS BUILDING
// ============================================

/**
 * Build final consensus from agent opinions
 *
 * Combines multiple consensus algorithms to produce a final result.
 *
 * @param opinions - All agent opinions
 * @param agentWeights - Optional specialist weights based on symptoms
 * @param threshold - Kendall's W threshold for consensus (default: 0.7)
 * @returns Partial consensus result
 */
export function buildConsensus(
  opinions: AgentOpinion[],
  agentWeights?: Record<string, number>,
  threshold = 0.7
): Partial<ConsensusResult> {
  if (opinions.length === 0) {
    return {
      consensusReached: false,
      roundsRequired: 0,
      participatingAgents: [],
      kendallW: 0,
    };
  }

  // Compute Kendall's W
  const kendallW = computeKendallWFromOpinions(opinions);
  const consensusReached = kendallW >= threshold;

  // Get weighted differential
  const differential = confidenceWeightedVote(opinions);

  // Analyze disagreement
  const disagreement = analyzeDisagreement(opinions);

  // Build consensus matrix for detailed analysis
  const consensusMatrix = buildConsensusMatrix(opinions, agentWeights);

  // Determine if human review is needed
  const humanReviewRequired =
    disagreement.level === 'major' ||
    differential.some(dx => dx.mustNotMiss && dx.confidence < 0.5);

  // Collect dissenting opinions
  const discordantAgents = identifyDiscordantAgents(opinions);
  const dissentingOpinions =
    discordantAgents.length > 0 ? discordantAgents : undefined;

  // Get current round number (max from opinions)
  const currentRound = Math.max(...opinions.map(o => o.debateRound || 1));

  return {
    kendallW,
    consensusReached,
    roundsRequired: currentRound,
    participatingAgents: opinions.map(o => o.agentId),
    primaryDiagnosis: differential[0] || undefined,
    differentialDiagnosis: differential,
    dissentingOpinions,
    humanReviewRequired,
    humanReviewReason: humanReviewRequired
      ? disagreement.level === 'major'
        ? 'Major disagreement among specialists'
        : 'Uncertainty about must-not-miss diagnosis'
      : undefined,
  };
}

// ============================================
// DEBATE ROUND HELPERS
// ============================================

/**
 * Determine if another debate round is needed
 *
 * @param currentConsensus - Current consensus state
 * @param maxRounds - Maximum allowed rounds
 * @returns Whether to continue debate
 */
export function shouldContinueDebate(
  currentConsensus: Partial<ConsensusResult>,
  maxRounds = 3
): boolean {
  // Already reached consensus
  if (currentConsensus.consensusReached) return false;

  // Exceeded max rounds
  if ((currentConsensus.roundsRequired || 0) >= maxRounds) return false;

  // Check disagreement level
  const kendallW = currentConsensus.kendallW || 0;

  // Very low agreement - another round might help
  if (kendallW < 0.5) return true;

  // Moderate agreement - one more round if not at max
  if (kendallW < 0.7 && (currentConsensus.roundsRequired || 0) < maxRounds) return true;

  return false;
}

/**
 * Get feedback prompts for discordant agents
 *
 * Generates prompts to help discordant agents reconsider their position.
 *
 * @param discordantAgents - Agents who deviate from consensus
 * @param consensusDifferential - Current consensus differential
 * @returns Feedback prompts by agent ID
 */
export function generateDiscordantFeedback(
  discordantAgents: AgentOpinion[],
  consensusDifferential: DifferentialDiagnosis[]
): Record<string, string> {
  const feedback: Record<string, string> = {};

  const topDiagnoses = consensusDifferential
    .slice(0, 3)
    .map(d => d.diagnosis)
    .join(', ');

  for (const agent of discordantAgents) {
    const agentTopDx = agent.differentialDiagnosis[0]?.diagnosis || 'unknown';

    feedback[agent.agentId] = `
Your assessment differs significantly from the emerging consensus.

CONSENSUS VIEW: The majority of specialists favor: ${topDiagnoses}

YOUR VIEW: You ranked "${agentTopDx}" as most likely.

Please reconsider:
1. What evidence specifically supports your primary diagnosis?
2. What would make you change your assessment?
3. Are there any consensus diagnoses you may have underweighted?

Provide an updated differential or explain why you maintain your position.
`.trim();
  }

  return feedback;
}

// ============================================
// UTILITY EXPORTS
// ============================================

/**
 * Compute summary statistics for consensus debugging
 */
export function getConsensusStats(opinions: AgentOpinion[]): {
  agentCount: number;
  diagnosisCount: number;
  kendallW: number;
  disagreementScore: number;
  avgConfidence: number;
  discordantCount: number;
} {
  const { diagnoses } = opinionsToRankingMatrix(opinions);

  return {
    agentCount: opinions.length,
    diagnosisCount: diagnoses.length,
    kendallW: computeKendallWFromOpinions(opinions),
    disagreementScore: measureDisagreement(opinions),
    avgConfidence:
      opinions.reduce((s, o) => s + (o.confidenceScore || 0.5), 0) / opinions.length,
    discordantCount: identifyDiscordantAgents(opinions).length,
  };
}
