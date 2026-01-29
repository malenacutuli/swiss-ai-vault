/**
 * HELIOS Grand Rounds Debate Service
 *
 * Implements the full multi-agent debate protocol for consensus diagnosis.
 * Orchestrates specialist agents through structured debate rounds until
 * consensus is reached or maximum rounds exceeded.
 *
 * Protocol:
 * 1. Case Presentation - Format patient data for specialists
 * 2. Specialist Recruitment - Select relevant specialists based on symptoms
 * 3. Independent Assessment - Each specialist provides initial opinion
 * 4. Consensus Computation - Measure agreement with Kendall's W
 * 5. Iterative Debate - Discordant agents debate until consensus
 * 6. Final Decision - Aggregate and validate final differential
 */

import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '@/integrations/supabase/client';
import type {
  TriageSession,
  OLDCARTSData,
  AgentOpinion,
  DifferentialDiagnosis,
  ConsensusResult,
  PlanOfAction,
  ESILevel,
  ICD10Code,
} from '@/types/medical-triage';
import type { SpecialistConfig, GrandRoundsConfig } from '@/types/medical-triage';
import {
  GRAND_ROUNDS_SPECIALISTS,
  selectRelevantSpecialists,
  DEFAULT_GRAND_ROUNDS_CONFIG,
} from '@/config/grand-rounds-agents';
import {
  computeKendallWFromOpinions,
  confidenceWeightedVote,
  computeAgentWeights,
  identifyDiscordantAgents,
  analyzeDisagreement,
  buildConsensus,
  shouldContinueDebate,
  generateDiscordantFeedback,
} from './consensus-service';
import { icd10Client, groundDifferentialList } from './icd10-service';

// ============================================
// TYPES
// ============================================

/**
 * Case complexity assessment
 */
export type CaseComplexity = 'low' | 'moderate' | 'high';

/**
 * Debate round result
 */
interface DebateRoundResult {
  round: number;
  opinions: AgentOpinion[];
  kendallW: number;
  consensusReached: boolean;
  discordantAgents: string[];
}

/**
 * Parsed specialist response
 */
interface ParsedSpecialistResponse {
  differentialDiagnosis: Array<{
    rank: number;
    diagnosis: string;
    icd10Code?: string;
    confidence: number;
    reasoning: string;
    supportingEvidence: string[];
    mustNotMiss?: boolean;
    urgency?: string;
  }>;
  overallConfidence: number;
  concerns: string[];
  additionalQuestions?: string[];
  recommendedWorkup?: string[];
}

/**
 * Case summary for specialists
 */
interface CaseSummary {
  patientInfo: string;
  chiefComplaint: string;
  hpiNarrative: string;
  oldcartsFormatted: string;
  redFlags: string[];
  relevantHistory: string;
  complexity: CaseComplexity;
}

// ============================================
// GRAND ROUNDS DEBATE CLASS
// ============================================

/**
 * Grand Rounds Debate Orchestrator
 *
 * Manages the full multi-agent debate protocol for consensus diagnosis.
 */
export class GrandRoundsDebate {
  private config: GrandRoundsConfig;
  private anthropic: Anthropic;
  private sessionId: string | null = null;

  constructor(config?: Partial<GrandRoundsConfig>, anthropic?: Anthropic) {
    this.config = {
      ...DEFAULT_GRAND_ROUNDS_CONFIG,
      specialists: GRAND_ROUNDS_SPECIALISTS,
      ...config,
    } as GrandRoundsConfig;

    this.anthropic = anthropic || new Anthropic();
  }

  // ============================================
  // MAIN RUN METHOD
  // ============================================

  /**
   * Run the full Grand Rounds debate protocol
   *
   * @param session - Triage session with patient data
   * @returns Final consensus result
   */
  async run(session: TriageSession): Promise<ConsensusResult> {
    this.sessionId = session.id;
    const startTime = Date.now();

    console.log(`[GrandRounds] Starting debate for session ${session.id}`);

    try {
      // PHASE 1: Case Presentation
      console.log('[GrandRounds] Phase 1: Case Presentation');
      const caseSummary = this.buildCaseSummary(session);

      // PHASE 2: Specialist Recruitment
      console.log('[GrandRounds] Phase 2: Specialist Recruitment');
      const symptoms = this.extractSymptoms(session);
      const specialists = selectRelevantSpecialists(symptoms);
      const agentWeights = computeAgentWeights(symptoms, specialists);

      console.log(
        `[GrandRounds] Recruited ${specialists.length} specialists:`,
        specialists.map(s => s.id).join(', ')
      );

      // PHASE 3: Independent Assessment
      console.log('[GrandRounds] Phase 3: Independent Assessment');
      let currentRound = 1;
      let opinions = await this.collectIndependentAssessments(
        specialists,
        caseSummary,
        currentRound
      );

      // Store initial opinions
      await this.storeOpinions(opinions);

      // PHASE 4: Initial Consensus Computation
      console.log('[GrandRounds] Phase 4: Consensus Computation');
      let kendallW = computeKendallWFromOpinions(opinions);
      let consensusReached = kendallW >= this.config.consensusThreshold;

      console.log(
        `[GrandRounds] Round ${currentRound}: Kendall's W = ${kendallW.toFixed(3)}, ` +
          `Consensus: ${consensusReached ? 'YES' : 'NO'}`
      );

      // PHASE 5: Iterative Debate (if needed)
      while (!consensusReached && currentRound < this.config.maxRounds) {
        console.log(`[GrandRounds] Phase 5: Iterative Debate - Round ${currentRound + 1}`);

        currentRound++;
        const roundResult = await this.runDebateRound(
          specialists,
          opinions,
          caseSummary,
          currentRound,
          agentWeights
        );

        opinions = roundResult.opinions;
        kendallW = roundResult.kendallW;
        consensusReached = roundResult.consensusReached;

        // Store updated opinions
        await this.storeOpinions(roundResult.opinions);

        console.log(
          `[GrandRounds] Round ${currentRound}: Kendall's W = ${kendallW.toFixed(3)}, ` +
            `Consensus: ${consensusReached ? 'YES' : 'NO'}`
        );
      }

      // PHASE 6: Final Decision
      console.log('[GrandRounds] Phase 6: Final Decision');
      const consensusResult = await this.buildFinalConsensus(
        opinions,
        agentWeights,
        currentRound,
        consensusReached,
        caseSummary
      );

      // Store consensus result
      await this.storeConsensusResult(consensusResult);

      const totalTime = Date.now() - startTime;
      console.log(
        `[GrandRounds] Completed in ${totalTime}ms. ` +
          `Consensus: ${consensusResult.consensusReached}, ` +
          `Primary Dx: ${consensusResult.primaryDiagnosis?.diagnosis || 'None'}`
      );

      return consensusResult;
    } catch (error) {
      console.error('[GrandRounds] Debate failed:', error);

      // Return error consensus
      return {
        kendallW: 0,
        consensusReached: false,
        roundsRequired: 0,
        participatingAgents: [],
        primaryDiagnosis: {
          rank: 1,
          diagnosis: 'Unable to complete assessment',
          icd10: { code: 'R69', name: 'Illness, unspecified', confidence: 0, validated: false },
          confidence: 0,
          reasoning: 'Debate protocol failed',
          supportingEvidence: [],
        },
        differentialDiagnosis: [],
        planOfAction: {
          labTests: [],
          imaging: [],
          referrals: ['Recommend in-person evaluation'],
        },
        humanReviewRequired: true,
        humanReviewReason: `Debate protocol error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        createdAt: new Date().toISOString(),
      };
    }
  }

  // ============================================
  // PHASE 1: CASE PRESENTATION
  // ============================================

  /**
   * Build structured case summary for specialists
   */
  private buildCaseSummary(session: TriageSession): CaseSummary {
    const oldcarts = session.oldcarts;

    // Format OLDCARTS into clinical narrative
    const oldcartsFormatted = this.formatOLDCARTS(oldcarts);

    // Build HPI narrative
    const hpiNarrative = this.buildHPINarrative(oldcarts, session);

    // Extract patient info
    const patientInfo = this.formatPatientInfo(session);

    // Identify red flags
    const redFlags = this.identifyRedFlags(session);

    // Assess complexity
    const complexity = this.assessComplexity(session, redFlags);

    // Format relevant history
    const relevantHistory = this.formatRelevantHistory(session);

    return {
      patientInfo,
      chiefComplaint: oldcarts.chiefComplaint,
      hpiNarrative,
      oldcartsFormatted,
      redFlags,
      relevantHistory,
      complexity,
    };
  }

  /**
   * Format OLDCARTS data into clinical format
   */
  private formatOLDCARTS(oldcarts: OLDCARTSData): string {
    const sections: string[] = [];

    if (oldcarts.onset?.value) {
      sections.push(`Onset: ${oldcarts.onset.value}`);
    }
    if (oldcarts.location?.value) {
      sections.push(`Location: ${oldcarts.location.value}`);
    }
    if (oldcarts.duration?.value) {
      sections.push(`Duration: ${oldcarts.duration.value}`);
    }
    if (oldcarts.character?.value) {
      sections.push(`Character: ${oldcarts.character.value}`);
    }
    if (oldcarts.aggravating?.value) {
      sections.push(`Aggravating factors: ${oldcarts.aggravating.value}`);
    }
    if (oldcarts.relieving?.value) {
      sections.push(`Relieving factors: ${oldcarts.relieving.value}`);
    }
    if (oldcarts.timing?.value) {
      sections.push(`Timing: ${oldcarts.timing.value}`);
    }
    if (oldcarts.severity?.value !== null && oldcarts.severity?.value !== undefined) {
      sections.push(`Severity: ${oldcarts.severity.value}/10`);
    }
    if (oldcarts.associatedSymptoms?.length) {
      sections.push(`Associated symptoms: ${oldcarts.associatedSymptoms.join(', ')}`);
    }

    return sections.join('\n');
  }

  /**
   * Build HPI narrative from OLDCARTS
   */
  private buildHPINarrative(oldcarts: OLDCARTSData, session: TriageSession): string {
    const parts: string[] = [];

    // Opening with chief complaint and onset
    if (oldcarts.onset?.value) {
      parts.push(`Patient presents with ${oldcarts.chiefComplaint} that began ${oldcarts.onset.value}.`);
    } else {
      parts.push(`Patient presents with ${oldcarts.chiefComplaint}.`);
    }

    // Location and character
    if (oldcarts.location?.value) {
      parts.push(`The symptom is located in/at ${oldcarts.location.value}.`);
    }
    if (oldcarts.character?.value) {
      parts.push(`Patient describes it as ${oldcarts.character.value}.`);
    }

    // Duration and timing
    if (oldcarts.duration?.value) {
      parts.push(`Each episode lasts ${oldcarts.duration.value}.`);
    }
    if (oldcarts.timing?.value) {
      parts.push(`Timing: ${oldcarts.timing.value}.`);
    }

    // Modifying factors
    if (oldcarts.aggravating?.value) {
      parts.push(`Worsened by: ${oldcarts.aggravating.value}.`);
    }
    if (oldcarts.relieving?.value) {
      parts.push(`Improved by: ${oldcarts.relieving.value}.`);
    }

    // Severity
    if (oldcarts.severity?.value !== null && oldcarts.severity?.value !== undefined) {
      parts.push(`Patient rates severity as ${oldcarts.severity.value}/10.`);
    }

    // Associated symptoms
    if (oldcarts.associatedSymptoms?.length) {
      parts.push(`Associated symptoms include: ${oldcarts.associatedSymptoms.join(', ')}.`);
    }

    return parts.join(' ');
  }

  /**
   * Format patient demographic info
   */
  private formatPatientInfo(session: TriageSession): string {
    const info: string[] = [];

    // Extract from metadata or conversation
    const metadata = session.metadata as Record<string, unknown> | undefined;
    const age = metadata?.age as number | undefined;
    const gender = metadata?.gender as string | undefined;

    if (age) info.push(`${age}-year-old`);
    if (gender) info.push(gender);

    if (info.length === 0) {
      return 'Adult patient';
    }

    return info.join(' ');
  }

  /**
   * Identify red flags from session
   */
  private identifyRedFlags(session: TriageSession): string[] {
    const redFlags: string[] = [];
    const chiefComplaint = session.oldcarts.chiefComplaint.toLowerCase();
    const severity = session.oldcarts.severity?.value;

    // Severity-based red flags
    if (severity !== null && severity !== undefined && severity >= 8) {
      redFlags.push('Severe pain (8+/10)');
    }

    // Symptom-based red flags
    const emergencyKeywords = [
      { keyword: 'chest pain', flag: 'Chest pain' },
      { keyword: 'difficulty breathing', flag: 'Respiratory distress' },
      { keyword: 'shortness of breath', flag: 'Dyspnea' },
      { keyword: 'sudden', flag: 'Sudden onset' },
      { keyword: 'worst headache', flag: 'Thunderclap headache' },
      { keyword: 'weakness', flag: 'Weakness' },
      { keyword: 'numbness', flag: 'Numbness' },
      { keyword: 'confusion', flag: 'Altered mental status' },
      { keyword: 'suicidal', flag: 'Suicidal ideation' },
      { keyword: 'blood', flag: 'Bleeding' },
      { keyword: 'fever', flag: 'Fever' },
    ];

    for (const { keyword, flag } of emergencyKeywords) {
      if (chiefComplaint.includes(keyword)) {
        redFlags.push(flag);
      }
    }

    // ESI-based red flags
    if (session.esiLevel && session.esiLevel <= 2) {
      redFlags.push(`ESI Level ${session.esiLevel}`);
    }

    return redFlags;
  }

  /**
   * Assess case complexity
   */
  private assessComplexity(session: TriageSession, redFlags: string[]): CaseComplexity {
    let complexityScore = 0;

    // Red flag count
    complexityScore += redFlags.length * 2;

    // Symptom count
    const symptoms = this.extractSymptoms(session);
    complexityScore += symptoms.length;

    // Severity
    const severity = session.oldcarts.severity?.value;
    if (severity !== null && severity !== undefined) {
      complexityScore += severity / 2;
    }

    // ESI level (lower = more complex)
    if (session.esiLevel) {
      complexityScore += (6 - session.esiLevel) * 2;
    }

    // Classify
    if (complexityScore >= 12) return 'high';
    if (complexityScore >= 6) return 'moderate';
    return 'low';
  }

  /**
   * Format relevant history
   */
  private formatRelevantHistory(session: TriageSession): string {
    const metadata = session.metadata as Record<string, unknown> | undefined;
    const parts: string[] = [];

    if (metadata?.medications) {
      parts.push(`Medications: ${(metadata.medications as string[]).join(', ')}`);
    }
    if (metadata?.allergies) {
      parts.push(`Allergies: ${(metadata.allergies as string[]).join(', ')}`);
    }
    if (metadata?.pastMedicalHistory) {
      parts.push(`PMH: ${(metadata.pastMedicalHistory as string[]).join(', ')}`);
    }

    return parts.length > 0 ? parts.join('\n') : 'No relevant history available.';
  }

  /**
   * Extract symptoms from session
   */
  private extractSymptoms(session: TriageSession): string[] {
    const symptoms: string[] = [session.oldcarts.chiefComplaint];

    if (session.oldcarts.associatedSymptoms) {
      symptoms.push(...session.oldcarts.associatedSymptoms);
    }

    // Extract from character description
    if (session.oldcarts.character?.value) {
      symptoms.push(String(session.oldcarts.character.value));
    }

    return symptoms;
  }

  // ============================================
  // PHASE 3: INDEPENDENT ASSESSMENT
  // ============================================

  /**
   * Collect independent assessments from all specialists
   */
  private async collectIndependentAssessments(
    specialists: SpecialistConfig[],
    caseSummary: CaseSummary,
    round: number
  ): Promise<AgentOpinion[]> {
    const assessmentPromises = specialists.map(specialist =>
      this.getSpecialistAssessment(specialist, caseSummary, round)
    );

    const results = await Promise.allSettled(assessmentPromises);

    const opinions: AgentOpinion[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled' && result.value) {
        opinions.push(result.value);
      } else {
        console.warn(
          `[GrandRounds] Specialist ${specialists[i].id} failed:`,
          result.status === 'rejected' ? result.reason : 'No response'
        );
      }
    }

    return opinions;
  }

  /**
   * Get assessment from a single specialist
   */
  private async getSpecialistAssessment(
    specialist: SpecialistConfig,
    caseSummary: CaseSummary,
    round: number,
    previousOpinions?: AgentOpinion[],
    feedbackPrompt?: string
  ): Promise<AgentOpinion | null> {
    const startTime = Date.now();

    try {
      const prompt = this.buildSpecialistPrompt(
        specialist,
        caseSummary,
        round,
        previousOpinions,
        feedbackPrompt
      );

      const response = await this.anthropic.messages.create({
        model: this.getModelId(specialist.model),
        max_tokens: 2000,
        system: specialist.systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      });

      const responseText =
        response.content[0].type === 'text' ? response.content[0].text : '';

      const parsed = this.parseAgentResponse(responseText, specialist);
      const processingTime = Date.now() - startTime;

      return {
        agentId: specialist.id,
        agentRole: specialist.role,
        specialistType: specialist.type,
        debateRound: round,
        differentialDiagnosis: parsed.differentialDiagnosis.map((dx, idx) => ({
          rank: dx.rank || idx + 1,
          diagnosis: dx.diagnosis,
          icd10: dx.icd10Code
            ? { code: dx.icd10Code, name: dx.diagnosis, confidence: dx.confidence, validated: false }
            : { code: 'PENDING', name: dx.diagnosis, confidence: dx.confidence, validated: false },
          confidence: dx.confidence,
          reasoning: dx.reasoning,
          supportingEvidence: dx.supportingEvidence,
          mustNotMiss: dx.mustNotMiss,
          urgency: dx.urgency as 'emergent' | 'urgent' | 'routine' | undefined,
        })),
        confidenceScore: parsed.overallConfidence,
        concerns: parsed.concerns,
        supportingEvidence: parsed.differentialDiagnosis[0]?.supportingEvidence || [],
        processingTimeMs: processingTime,
        tokenCount: response.usage?.output_tokens,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[GrandRounds] Specialist ${specialist.id} error:`, error);
      return null;
    }
  }

  /**
   * Build prompt for specialist
   */
  private buildSpecialistPrompt(
    specialist: SpecialistConfig,
    caseSummary: CaseSummary,
    round: number,
    previousOpinions?: AgentOpinion[],
    feedbackPrompt?: string
  ): string {
    let prompt = `
GRAND ROUNDS CASE PRESENTATION - Round ${round}

PATIENT INFORMATION:
${caseSummary.patientInfo}

CHIEF COMPLAINT:
${caseSummary.chiefComplaint}

HISTORY OF PRESENT ILLNESS:
${caseSummary.hpiNarrative}

OLDCARTS ASSESSMENT:
${caseSummary.oldcartsFormatted}

RELEVANT HISTORY:
${caseSummary.relevantHistory}

${caseSummary.redFlags.length > 0 ? `RED FLAGS IDENTIFIED:\n${caseSummary.redFlags.map(f => `⚠️ ${f}`).join('\n')}` : ''}

CASE COMPLEXITY: ${caseSummary.complexity.toUpperCase()}

---

As ${specialist.role}, please provide your clinical assessment.

REQUIRED OUTPUT FORMAT (respond in JSON):
{
  "differentialDiagnosis": [
    {
      "rank": 1,
      "diagnosis": "Primary diagnosis name",
      "icd10Code": "ICD-10-CM code (e.g., J06.9)",
      "confidence": 0.85,
      "reasoning": "Clinical reasoning for this diagnosis",
      "supportingEvidence": ["Evidence point 1", "Evidence point 2"],
      "mustNotMiss": false,
      "urgency": "routine|urgent|emergent"
    }
  ],
  "overallConfidence": 0.80,
  "concerns": ["Clinical concern 1", "Limitation 2"],
  "recommendedWorkup": ["Test 1", "Test 2"]
}

REQUIREMENTS:
1. Provide 3-5 differential diagnoses ranked by likelihood
2. Include ICD-10-CM codes for each diagnosis
3. Cite specific evidence from the case for each diagnosis
4. Note any "must not miss" diagnoses even if low probability
5. Express confidence honestly - uncertainty is acceptable
6. Flag concerns about missing information
`;

    // Add previous opinions context for debate rounds
    if (round > 1 && previousOpinions && previousOpinions.length > 0) {
      prompt += `

---
PREVIOUS ROUND OPINIONS (for reference):
${previousOpinions
  .map(
    op => `
${op.agentRole}:
- Primary: ${op.differentialDiagnosis[0]?.diagnosis || 'None'} (${(op.differentialDiagnosis[0]?.confidence * 100).toFixed(0)}%)
- Confidence: ${(op.confidenceScore * 100).toFixed(0)}%`
  )
  .join('\n')}
`;
    }

    // Add feedback for discordant agents
    if (feedbackPrompt) {
      prompt += `

---
MODERATOR FEEDBACK:
${feedbackPrompt}

Please reconsider your assessment in light of this feedback.
`;
    }

    return prompt;
  }

  /**
   * Parse agent response into structured format
   */
  private parseAgentResponse(
    response: string,
    specialist: SpecialistConfig
  ): ParsedSpecialistResponse {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        return {
          differentialDiagnosis: (parsed.differentialDiagnosis || []).map(
            (dx: Record<string, unknown>, idx: number) => ({
              rank: (dx.rank as number) || idx + 1,
              diagnosis: (dx.diagnosis as string) || 'Unknown',
              icd10Code: dx.icd10Code as string | undefined,
              confidence: Math.min(1, Math.max(0, (dx.confidence as number) || 0.5)),
              reasoning: (dx.reasoning as string) || '',
              supportingEvidence: (dx.supportingEvidence as string[]) || [],
              mustNotMiss: (dx.mustNotMiss as boolean) || false,
              urgency: dx.urgency as string | undefined,
            })
          ),
          overallConfidence: Math.min(
            1,
            Math.max(0, (parsed.overallConfidence as number) || 0.5)
          ),
          concerns: (parsed.concerns as string[]) || [],
          additionalQuestions: parsed.additionalQuestions as string[] | undefined,
          recommendedWorkup: parsed.recommendedWorkup as string[] | undefined,
        };
      }
    } catch (error) {
      console.warn(`[GrandRounds] Failed to parse ${specialist.id} response:`, error);
    }

    // Fallback: try to extract diagnoses from text
    return this.parseUnstructuredResponse(response, specialist);
  }

  /**
   * Parse unstructured response as fallback
   */
  private parseUnstructuredResponse(
    response: string,
    specialist: SpecialistConfig
  ): ParsedSpecialistResponse {
    // Simple extraction of potential diagnoses
    const lines = response.split('\n');
    const diagnoses: ParsedSpecialistResponse['differentialDiagnosis'] = [];

    let rank = 0;
    for (const line of lines) {
      // Look for numbered diagnoses
      const match = line.match(/^\d+\.\s*(.+)/);
      if (match && rank < 5) {
        rank++;
        diagnoses.push({
          rank,
          diagnosis: match[1].trim(),
          confidence: 0.5 - rank * 0.05,
          reasoning: 'Extracted from unstructured response',
          supportingEvidence: [],
        });
      }
    }

    return {
      differentialDiagnosis: diagnoses,
      overallConfidence: 0.4,
      concerns: ['Response was not in expected format'],
    };
  }

  /**
   * Get Anthropic model ID from config
   */
  private getModelId(model: 'opus' | 'sonnet' | 'haiku'): string {
    switch (model) {
      case 'opus':
        return 'claude-opus-4-20250514';
      case 'haiku':
        return 'claude-3-5-haiku-20241022';
      default:
        return 'claude-sonnet-4-20250514';
    }
  }

  // ============================================
  // PHASE 5: ITERATIVE DEBATE
  // ============================================

  /**
   * Run a single debate round
   */
  private async runDebateRound(
    specialists: SpecialistConfig[],
    previousOpinions: AgentOpinion[],
    caseSummary: CaseSummary,
    round: number,
    agentWeights: Record<string, number>
  ): Promise<DebateRoundResult> {
    // Identify discordant agents
    const discordantOpinions = identifyDiscordantAgents(previousOpinions);
    const discordantAgentIds = discordantOpinions.map(o => o.agentId);

    console.log(
      `[GrandRounds] Round ${round}: ${discordantAgentIds.length} discordant agents`
    );

    // Generate current differential for feedback
    const currentDifferential = confidenceWeightedVote(previousOpinions);

    // Generate feedback for discordant agents
    const feedbackPrompts = generateDiscordantFeedback(discordantOpinions, currentDifferential);

    // Collect new opinions - discordant agents get feedback
    const updatedOpinions: AgentOpinion[] = [];

    const assessmentPromises = specialists.map(specialist => {
      const isDiscordant = discordantAgentIds.includes(specialist.id);
      const feedback = isDiscordant ? feedbackPrompts[specialist.id] : undefined;

      return this.getSpecialistAssessment(
        specialist,
        caseSummary,
        round,
        previousOpinions,
        feedback
      );
    });

    const results = await Promise.allSettled(assessmentPromises);

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        updatedOpinions.push(result.value);
      }
    }

    // Compute new Kendall's W
    const kendallW = computeKendallWFromOpinions(updatedOpinions);
    const consensusReached = kendallW >= this.config.consensusThreshold;

    return {
      round,
      opinions: updatedOpinions,
      kendallW,
      consensusReached,
      discordantAgents: discordantAgentIds,
    };
  }

  /**
   * Generate challenge prompt for debate
   */
  private generateChallenge(
    challengingAgent: AgentOpinion,
    targetOpinion: AgentOpinion
  ): string {
    const challengerDx = challengingAgent.differentialDiagnosis[0];
    const targetDx = targetOpinion.differentialDiagnosis[0];

    return `
As ${challengingAgent.agentRole}, you disagree with ${targetOpinion.agentRole}'s assessment.

Their primary diagnosis: ${targetDx?.diagnosis} (${(targetDx?.confidence * 100).toFixed(0)}% confident)
Your primary diagnosis: ${challengerDx?.diagnosis} (${(challengerDx?.confidence * 100).toFixed(0)}% confident)

Please explain:
1. Why you believe their primary diagnosis is less likely
2. What evidence supports your alternative diagnosis
3. What finding would change your opinion

Be respectful but direct in your clinical reasoning.
`;
  }

  // ============================================
  // PHASE 6: FINAL DECISION
  // ============================================

  /**
   * Build final consensus result
   */
  private async buildFinalConsensus(
    opinions: AgentOpinion[],
    agentWeights: Record<string, number>,
    roundsRequired: number,
    consensusReached: boolean,
    caseSummary: CaseSummary
  ): Promise<ConsensusResult> {
    // Aggregate final differential using weighted voting
    const rawDifferential = confidenceWeightedVote(opinions);

    // Validate diagnoses via ICD-10 service
    const diagnosisTexts = rawDifferential.map(dx => dx.diagnosis);
    const groundedDiagnoses = await groundDifferentialList(diagnosisTexts);

    // Map grounded codes back to differential
    const validatedDifferential: DifferentialDiagnosis[] = [];

    for (const dx of rawDifferential) {
      const grounded = groundedDiagnoses.find(
        g => g.originalDiagnosis.toLowerCase() === dx.diagnosis.toLowerCase()
      );

      if (grounded) {
        validatedDifferential.push({
          ...dx,
          icd10: grounded.icd10,
        });
      } else {
        // Keep unvalidated but mark as such
        validatedDifferential.push({
          ...dx,
          icd10: {
            ...dx.icd10,
            validated: false,
          },
        });
      }
    }

    // Re-rank validated differential
    validatedDifferential.forEach((dx, idx) => {
      dx.rank = idx + 1;
    });

    // Compute final Kendall's W
    const kendallW = computeKendallWFromOpinions(opinions);

    // Identify discordant agents for dissenting opinions
    const discordantOpinions = identifyDiscordantAgents(opinions);

    // Aggregate plan of action
    const planOfAction = this.aggregatePlanOfAction(opinions, validatedDifferential);

    // Determine ESI level from consensus
    const finalEsiLevel = this.determineEsiLevel(validatedDifferential, caseSummary);

    // Determine if human review is needed
    const disagreement = analyzeDisagreement(opinions);
    const humanReviewRequired =
      !consensusReached ||
      disagreement.level === 'major' ||
      validatedDifferential.some(dx => dx.mustNotMiss && dx.confidence < 0.5);

    return {
      kendallW,
      consensusReached,
      roundsRequired,
      participatingAgents: opinions.map(o => o.agentId),
      primaryDiagnosis: validatedDifferential[0],
      differentialDiagnosis: validatedDifferential,
      planOfAction,
      dissentingOpinions: discordantOpinions.length > 0 ? discordantOpinions : undefined,
      finalEsiLevel,
      humanReviewRequired,
      humanReviewReason: humanReviewRequired
        ? this.getHumanReviewReason(consensusReached, disagreement)
        : undefined,
      disposition: this.determineDisposition(finalEsiLevel, validatedDifferential),
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Aggregate plan of action from all opinions
   */
  private aggregatePlanOfAction(
    opinions: AgentOpinion[],
    differential: DifferentialDiagnosis[]
  ): PlanOfAction {
    const labTests = new Set<string>();
    const imaging = new Set<string>();
    const referrals = new Set<string>();
    const medications = new Set<string>();
    const patientEducation = new Set<string>();

    // Collect recommended workup from all opinions
    for (const opinion of opinions) {
      const metadata = opinion as unknown as Record<string, unknown>;
      const workup = metadata.recommendedWorkup as string[] | undefined;

      if (workup) {
        for (const item of workup) {
          const lower = item.toLowerCase();

          if (
            lower.includes('lab') ||
            lower.includes('blood') ||
            lower.includes('cbc') ||
            lower.includes('bmp') ||
            lower.includes('troponin')
          ) {
            labTests.add(item);
          } else if (
            lower.includes('xray') ||
            lower.includes('x-ray') ||
            lower.includes('ct') ||
            lower.includes('mri') ||
            lower.includes('ultrasound')
          ) {
            imaging.add(item);
          } else if (
            lower.includes('refer') ||
            lower.includes('consult') ||
            lower.includes('specialist')
          ) {
            referrals.add(item);
          }
        }
      }
    }

    // Add standard workup based on top differential
    const topDx = differential[0];
    if (topDx) {
      const dxLower = topDx.diagnosis.toLowerCase();

      if (dxLower.includes('cardiac') || dxLower.includes('chest pain')) {
        labTests.add('Troponin I/T');
        labTests.add('BMP');
        imaging.add('ECG/EKG');
        imaging.add('Chest X-ray');
      }

      if (dxLower.includes('infection') || dxLower.includes('pneumonia')) {
        labTests.add('CBC with differential');
        labTests.add('CRP');
        imaging.add('Chest X-ray');
      }
    }

    // Generate patient education points
    if (topDx) {
      patientEducation.add(`Information about ${topDx.diagnosis}`);
    }
    patientEducation.add('Warning signs requiring immediate care');
    patientEducation.add('Follow-up timeline and expectations');

    // Determine follow-up
    let followUp = 'Follow up with primary care within 1-2 weeks';
    if (differential.some(dx => dx.urgency === 'urgent')) {
      followUp = 'Follow up within 24-48 hours or sooner if symptoms worsen';
    }

    return {
      labTests: Array.from(labTests),
      imaging: Array.from(imaging),
      referrals: Array.from(referrals),
      medications: Array.from(medications).length > 0 ? Array.from(medications) : undefined,
      patientEducation: Array.from(patientEducation),
      followUp,
      redFlagWarnings: this.generateRedFlagWarnings(differential),
    };
  }

  /**
   * Generate red flag warnings for patients
   */
  private generateRedFlagWarnings(differential: DifferentialDiagnosis[]): string[] {
    const warnings = new Set<string>();

    warnings.add('Seek immediate care if symptoms suddenly worsen');
    warnings.add('Call 911 if you experience difficulty breathing or severe chest pain');

    for (const dx of differential) {
      if (dx.mustNotMiss) {
        warnings.add(`Watch for signs of ${dx.diagnosis}`);
      }

      if (dx.urgency === 'emergent') {
        warnings.add('This may require emergency evaluation - do not delay if concerned');
      }
    }

    return Array.from(warnings);
  }

  /**
   * Determine ESI level from consensus
   */
  private determineEsiLevel(
    differential: DifferentialDiagnosis[],
    caseSummary: CaseSummary
  ): ESILevel {
    // Start with complexity-based estimate
    let esiLevel: ESILevel = caseSummary.complexity === 'high' ? 2 : caseSummary.complexity === 'moderate' ? 3 : 4;

    // Adjust based on red flags
    if (caseSummary.redFlags.length >= 3) {
      esiLevel = Math.min(esiLevel, 2) as ESILevel;
    }

    // Adjust based on urgency of differential
    if (differential.some(dx => dx.urgency === 'emergent')) {
      esiLevel = Math.min(esiLevel, 2) as ESILevel;
    } else if (differential.some(dx => dx.urgency === 'urgent')) {
      esiLevel = Math.min(esiLevel, 3) as ESILevel;
    }

    return esiLevel;
  }

  /**
   * Determine disposition recommendation
   */
  private determineDisposition(
    esiLevel: ESILevel | undefined,
    differential: DifferentialDiagnosis[]
  ): string {
    if (!esiLevel) return 'pcp_routine';

    switch (esiLevel) {
      case 1:
        return 'ED';
      case 2:
        return 'ED';
      case 3:
        return differential.some(dx => dx.urgency === 'urgent') ? 'urgent_care' : 'pcp_24h';
      case 4:
        return 'pcp_routine';
      case 5:
        return 'self_care';
      default:
        return 'pcp_routine';
    }
  }

  /**
   * Get human review reason
   */
  private getHumanReviewReason(
    consensusReached: boolean,
    disagreement: ReturnType<typeof analyzeDisagreement>
  ): string {
    if (!consensusReached) {
      return 'Consensus not reached after maximum debate rounds';
    }
    if (disagreement.level === 'major') {
      return 'Major disagreement among specialists';
    }
    return 'Uncertainty about critical diagnosis';
  }

  // ============================================
  // DATABASE OPERATIONS
  // ============================================

  /**
   * Store agent opinions in database
   */
  private async storeOpinions(opinions: AgentOpinion[]): Promise<void> {
    if (!this.sessionId) return;

    try {
      const records = opinions.map(opinion => ({
        session_id: this.sessionId,
        debate_round: opinion.debateRound,
        agent_id: opinion.agentId,
        agent_role: opinion.agentRole,
        agent_model: opinion.specialistType || 'sonnet',
        differential_diagnosis: opinion.differentialDiagnosis,
        confidence_score: opinion.confidenceScore,
        concerns: opinion.concerns,
        supporting_evidence: opinion.supportingEvidence,
        dissenting_opinion: opinion.dissentingOpinion,
        processing_time_ms: opinion.processingTimeMs,
        token_count: opinion.tokenCount,
        created_at: opinion.createdAt,
      }));

      const { error } = await supabase.from('agent_opinions').upsert(records, {
        onConflict: 'session_id,debate_round,agent_id',
      });

      if (error) {
        console.warn('[GrandRounds] Failed to store opinions:', error);
      }
    } catch (err) {
      console.warn('[GrandRounds] Opinion storage error:', err);
    }
  }

  /**
   * Store consensus result in database
   */
  private async storeConsensusResult(result: ConsensusResult): Promise<void> {
    if (!this.sessionId) return;

    try {
      const { error } = await supabase.from('consensus_results').upsert(
        {
          session_id: this.sessionId,
          kendall_w: result.kendallW,
          consensus_reached: result.consensusReached,
          rounds_required: result.roundsRequired,
          participating_agents: result.participatingAgents,
          primary_diagnosis: result.primaryDiagnosis,
          differential_diagnosis: result.differentialDiagnosis,
          plan_of_action: result.planOfAction,
          dissenting_opinions: result.dissentingOpinions,
          human_review_required: result.humanReviewRequired,
          human_review_reason: result.humanReviewReason,
          final_esi_level: result.finalEsiLevel,
          disposition: result.disposition,
          created_at: result.createdAt,
        },
        { onConflict: 'session_id' }
      );

      if (error) {
        console.warn('[GrandRounds] Failed to store consensus:', error);
      }
    } catch (err) {
      console.warn('[GrandRounds] Consensus storage error:', err);
    }
  }
}

// ============================================
// FACTORY AND EXPORTS
// ============================================

/**
 * Create a new Grand Rounds debate instance
 */
export function createGrandRoundsDebate(
  config?: Partial<GrandRoundsConfig>,
  anthropic?: Anthropic
): GrandRoundsDebate {
  return new GrandRoundsDebate(config, anthropic);
}

/**
 * Run Grand Rounds debate for a session
 */
export async function runGrandRounds(
  session: TriageSession,
  config?: Partial<GrandRoundsConfig>
): Promise<ConsensusResult> {
  const debate = createGrandRoundsDebate(config);
  return debate.run(session);
}
