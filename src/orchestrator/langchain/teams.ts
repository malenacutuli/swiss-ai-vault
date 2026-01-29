/**
 * Team Coordination Layer
 * Manages how teams of agents work together
 */

import { AgentTeam } from './taxonomy';
import { createAgentNode, createSupervisorNode, AgentState } from './nodes';
import { ConsensusResult, buildDifferentialConsensus, buildTriageConsensus, buildSafetyConsensus } from './consensus';

export interface TeamResult {
  team: AgentTeam;
  supervisor: string;
  participatingAgents: string[];
  outputs: Map<string, unknown>;
  consensus?: ConsensusResult;
  finalRecommendation: string;
  confidence: number;
  processingTimeMs: number;
}

/**
 * Intake Team Coordinator
 * Manages initial patient contact
 */
export async function runIntakeTeam(
  sessionId: string,
  state: AgentState
): Promise<TeamResult> {
  const startTime = Date.now();
  const outputs = new Map<string, unknown>();
  const participatingAgents: string[] = [];

  // 1. Greeter welcomes patient
  const greeterNode = createAgentNode('intake_greeter');
  const greeterResult = await greeterNode(state);
  outputs.set('intake_greeter', greeterResult);
  participatingAgents.push('intake_greeter');

  // 2. Language detector determines preferred language
  const languageNode = createAgentNode('intake_language');
  const languageResult = await languageNode({ ...state, ...greeterResult });
  outputs.set('intake_language', languageResult);
  participatingAgents.push('intake_language');

  // 3. Demographics collector gathers basic info
  const demographicsNode = createAgentNode('intake_demographics');
  const demographicsResult = await demographicsNode({ ...state, ...languageResult });
  outputs.set('intake_demographics', demographicsResult);
  participatingAgents.push('intake_demographics');

  // 4. Urgency screener does quick safety check
  const urgencyNode = createAgentNode('intake_urgency');
  const urgencyResult = await urgencyNode({ ...state, ...demographicsResult });
  outputs.set('intake_urgency', urgencyResult);
  participatingAgents.push('intake_urgency');

  // 5. Supervisor synthesizes
  const supervisorNode = createSupervisorNode('intake_chief');
  const supervisorResult = await supervisorNode({
    ...state,
    agentOutputs: outputs as Map<string, any>,
  });

  return {
    team: 'intake',
    supervisor: 'intake_chief',
    participatingAgents,
    outputs,
    finalRecommendation: (supervisorResult as any).finalResponse || '',
    confidence: 0.9,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * History Team Coordinator
 * Manages comprehensive history gathering
 */
export async function runHistoryTeam(
  sessionId: string,
  state: AgentState,
  userMessage: string
): Promise<TeamResult> {
  const startTime = Date.now();
  const outputs = new Map<string, unknown>();
  const participatingAgents: string[] = [];

  // Determine which history agents to run based on current state
  const completedSections = state.caseData.completedHistorySections as string[] || [];

  // Always run chief complaint first if not done
  if (!completedSections.includes('chief_complaint')) {
    const ccNode = createAgentNode('history_cc');
    const ccResult = await ccNode({ ...state, messages: [...state.messages, { role: 'user', content: userMessage }] } as any);
    outputs.set('history_cc', ccResult);
    participatingAgents.push('history_cc');
  }

  // Then HPI
  if (!completedSections.includes('hpi')) {
    const hpiNode = createAgentNode('history_hpi');
    const hpiResult = await hpiNode({ ...state, agentOutputs: outputs as Map<string, any> });
    outputs.set('history_hpi', hpiResult);
    participatingAgents.push('history_hpi');
  }

  // Run medication reviewer (important for safety)
  const medsNode = createAgentNode('history_meds');
  const medsResult = await medsNode({ ...state, agentOutputs: outputs as Map<string, any> });
  outputs.set('history_meds', medsResult);
  participatingAgents.push('history_meds');

  // Run allergy checker
  const allergyNode = createAgentNode('history_allergy');
  const allergyResult = await allergyNode({ ...state, agentOutputs: outputs as Map<string, any> });
  outputs.set('history_allergy', allergyResult);
  participatingAgents.push('history_allergy');

  // PMH
  const pmhNode = createAgentNode('history_pmh');
  const pmhResult = await pmhNode({ ...state, agentOutputs: outputs as Map<string, any> });
  outputs.set('history_pmh', pmhResult);
  participatingAgents.push('history_pmh');

  // Supervisor synthesizes and determines next question
  const supervisorNode = createSupervisorNode('history_chief');
  const supervisorResult = await supervisorNode({
    ...state,
    agentOutputs: outputs as Map<string, any>,
  });

  return {
    team: 'history',
    supervisor: 'history_chief',
    participatingAgents,
    outputs,
    finalRecommendation: (supervisorResult as any).finalResponse || '',
    confidence: calculateHistoryCompleteness(outputs),
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Triage Team Coordinator
 * Manages acuity assessment with consensus
 */
export async function runTriageTeam(
  sessionId: string,
  state: AgentState
): Promise<TeamResult> {
  const startTime = Date.now();
  const outputs = new Map<string, unknown>();
  const participatingAgents: string[] = [];

  // Run core triage agents in parallel
  const [esiResult, acuityResult, resourceResult] = await Promise.all([
    createAgentNode('triage_esi')(state),
    createAgentNode('triage_acuity')(state),
    createAgentNode('triage_resource')(state),
  ]);

  outputs.set('triage_esi', esiResult);
  outputs.set('triage_acuity', acuityResult);
  outputs.set('triage_resource', resourceResult);
  participatingAgents.push('triage_esi', 'triage_acuity', 'triage_resource');

  // Run specialty triage if applicable
  const patientAge = state.caseData.patientAge as number;
  if (patientAge && patientAge < 18) {
    const pedsResult = await createAgentNode('triage_pediatric')(state);
    outputs.set('triage_pediatric', pedsResult);
    participatingAgents.push('triage_pediatric');
  }
  if (patientAge && patientAge > 65) {
    const geriResult = await createAgentNode('triage_geriatric')(state);
    outputs.set('triage_geriatric', geriResult);
    participatingAgents.push('triage_geriatric');
  }

  // Build consensus on ESI level
  const consensus = await buildTriageConsensus(sessionId, state.caseData);

  // Supervisor makes final determination
  const supervisorNode = createSupervisorNode('triage_chief');
  const supervisorResult = await supervisorNode({
    ...state,
    agentOutputs: outputs as Map<string, any>,
    caseData: {
      ...state.caseData,
      triageConsensus: consensus,
    },
  });

  return {
    team: 'triage',
    supervisor: 'triage_chief',
    participatingAgents,
    outputs,
    consensus,
    finalRecommendation: (supervisorResult as any).finalResponse || '',
    confidence: consensus.achieved ? 0.9 : 0.7,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Differential Team Coordinator
 * Manages diagnostic hypothesis generation with specialist consultation
 */
export async function runDifferentialTeam(
  sessionId: string,
  state: AgentState
): Promise<TeamResult> {
  const startTime = Date.now();
  const outputs = new Map<string, unknown>();
  const participatingAgents: string[] = [];

  // 1. Generate initial hypotheses
  const hypothesisNode = createAgentNode('diff_hypothesis');
  const hypothesisResult = await hypothesisNode(state);
  outputs.set('diff_hypothesis', hypothesisResult);
  participatingAgents.push('diff_hypothesis');

  // 2. Check must-not-miss diagnoses
  const mnmNode = createAgentNode('diff_mustnotmiss');
  const mnmResult = await mnmNode({ ...state, agentOutputs: outputs as Map<string, any> });
  outputs.set('diff_mustnotmiss', mnmResult);
  participatingAgents.push('diff_mustnotmiss');

  // 3. Run relevant specialty differential agents based on symptoms
  const symptoms = state.caseData.symptoms as string[] || [];
  const specialtyAgents = determineRelevantSpecialties(symptoms);

  for (const agentId of specialtyAgents) {
    const specialtyNode = createAgentNode(agentId);
    const specialtyResult = await specialtyNode({ ...state, agentOutputs: outputs as Map<string, any> });
    outputs.set(agentId, specialtyResult);
    participatingAgents.push(agentId);
  }

  // 4. Evidence weigher evaluates all hypotheses
  const evidenceNode = createAgentNode('diff_evidence');
  const evidenceResult = await evidenceNode({ ...state, agentOutputs: outputs as Map<string, any> });
  outputs.set('diff_evidence', evidenceResult);
  participatingAgents.push('diff_evidence');

  // 5. Build consensus on differential
  const consensus = await buildDifferentialConsensus(
    sessionId,
    symptoms,
    state.caseData,
    state.language
  );

  // 6. Supervisor synthesizes
  const supervisorNode = createSupervisorNode('diff_chief');
  const supervisorResult = await supervisorNode({
    ...state,
    agentOutputs: outputs as Map<string, any>,
    caseData: {
      ...state.caseData,
      differentialConsensus: consensus,
    },
  });

  return {
    team: 'differential',
    supervisor: 'diff_chief',
    participatingAgents,
    outputs,
    consensus,
    finalRecommendation: (supervisorResult as any).finalResponse || '',
    confidence: consensus.achieved ? 0.85 : 0.65,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Safety Team Coordinator
 * Runs continuous safety monitoring
 */
export async function runSafetyTeam(
  sessionId: string,
  state: AgentState
): Promise<TeamResult> {
  const startTime = Date.now();
  const outputs = new Map<string, unknown>();
  const participatingAgents: string[] = [];

  // Run all safety monitors in parallel
  const safetyAgents = [
    'safety_cardiac',
    'safety_neuro',
    'safety_resp',
    'safety_psych',
    'safety_sepsis',
  ];

  const safetyResults = await Promise.all(
    safetyAgents.map(async (agentId) => {
      const node = createAgentNode(agentId);
      const result = await node(state);
      return { agentId, result };
    })
  );

  for (const { agentId, result } of safetyResults) {
    outputs.set(agentId, result);
    participatingAgents.push(agentId);
  }

  // Collect all potential red flags
  const potentialFlags = safetyResults
    .flatMap(({ result }) => (result.safetyFlags || []) as any[])
    .map((f: any) => f.description);

  // Build safety consensus
  const consensus = await buildSafetyConsensus(
    sessionId,
    potentialFlags,
    state.caseData
  );

  // Safety chief makes final determination
  const supervisorNode = createSupervisorNode('safety_chief');
  const supervisorResult = await supervisorNode({
    ...state,
    agentOutputs: outputs as Map<string, any>,
    caseData: {
      ...state.caseData,
      safetyConsensus: consensus,
    },
  });

  return {
    team: 'safety',
    supervisor: 'safety_chief',
    participatingAgents,
    outputs,
    consensus,
    finalRecommendation: (supervisorResult as any).finalResponse || '',
    confidence: 0.95, // Safety always high confidence
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Plan Team Coordinator
 * Manages treatment and disposition recommendations
 */
export async function runPlanTeam(
  sessionId: string,
  state: AgentState
): Promise<TeamResult> {
  const startTime = Date.now();
  const outputs = new Map<string, unknown>();
  const participatingAgents: string[] = [];

  // 1. Generate treatment recommendations
  const treatmentNode = createAgentNode('plan_treatment');
  const treatmentResult = await treatmentNode(state);
  outputs.set('plan_treatment', treatmentResult);
  participatingAgents.push('plan_treatment');

  // 2. Determine disposition
  const dispositionNode = createAgentNode('plan_disposition');
  const dispositionResult = await dispositionNode({ ...state, agentOutputs: outputs as Map<string, any> });
  outputs.set('plan_disposition', dispositionResult);
  participatingAgents.push('plan_disposition');

  // 3. Generate follow-up recommendations
  const followupNode = createAgentNode('plan_followup');
  const followupResult = await followupNode({ ...state, agentOutputs: outputs as Map<string, any> });
  outputs.set('plan_followup', followupResult);
  participatingAgents.push('plan_followup');

  // 4. Create patient education
  const educationNode = createAgentNode('plan_education');
  const educationResult = await educationNode({ ...state, agentOutputs: outputs as Map<string, any> });
  outputs.set('plan_education', educationResult);
  participatingAgents.push('plan_education');

  // Supervisor synthesizes final plan
  const supervisorNode = createSupervisorNode('plan_chief');
  const supervisorResult = await supervisorNode({
    ...state,
    agentOutputs: outputs as Map<string, any>,
  });

  return {
    team: 'plan',
    supervisor: 'plan_chief',
    participatingAgents,
    outputs,
    finalRecommendation: (supervisorResult as any).finalResponse || '',
    confidence: 0.85,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Documentation Team Coordinator
 * Generates clinical documentation
 */
export async function runDocumentationTeam(
  sessionId: string,
  state: AgentState
): Promise<TeamResult> {
  const startTime = Date.now();
  const outputs = new Map<string, unknown>();
  const participatingAgents: string[] = [];

  // 1. Generate SOAP note
  const soapNode = createAgentNode('doc_soap');
  const soapResult = await soapNode(state);
  outputs.set('doc_soap', soapResult);
  participatingAgents.push('doc_soap');

  // 2. Create patient summary
  const summaryNode = createAgentNode('doc_summary');
  const summaryResult = await summaryNode({ ...state, agentOutputs: outputs as Map<string, any> });
  outputs.set('doc_summary', summaryResult);
  participatingAgents.push('doc_summary');

  // 3. Generate discharge instructions
  const dischargeNode = createAgentNode('doc_discharge');
  const dischargeResult = await dischargeNode({ ...state, agentOutputs: outputs as Map<string, any> });
  outputs.set('doc_discharge', dischargeResult);
  participatingAgents.push('doc_discharge');

  // Supervisor reviews documentation
  const supervisorNode = createSupervisorNode('doc_chief');
  const supervisorResult = await supervisorNode({
    ...state,
    agentOutputs: outputs as Map<string, any>,
  });

  return {
    team: 'documentation',
    supervisor: 'doc_chief',
    participatingAgents,
    outputs,
    finalRecommendation: (supervisorResult as any).finalResponse || '',
    confidence: 0.9,
    processingTimeMs: Date.now() - startTime,
  };
}

// Helper functions

function calculateHistoryCompleteness(outputs: Map<string, unknown>): number {
  const requiredSections = ['history_cc', 'history_hpi', 'history_meds', 'history_allergy'];
  const completedCount = requiredSections.filter(s => outputs.has(s)).length;
  return completedCount / requiredSections.length;
}

function determineRelevantSpecialties(symptoms: string[]): string[] {
  const relevant: string[] = [];

  const symptomsLower = symptoms.map(s => s.toLowerCase()).join(' ');

  if (/chest|heart|palpitation|edema/.test(symptomsLower)) {
    relevant.push('diff_cardio');
  }
  if (/cough|breath|wheez|lung/.test(symptomsLower)) {
    relevant.push('diff_pulm');
  }
  if (/abdom|nausea|vomit|diarrhea|bowel/.test(symptomsLower)) {
    relevant.push('diff_gi');
  }
  if (/head|dizz|numb|weak|vision|seiz/.test(symptomsLower)) {
    relevant.push('diff_neuro');
  }
  if (/joint|muscle|back|pain/.test(symptomsLower)) {
    relevant.push('diff_msk');
  }
  if (/skin|rash|itch|lesion/.test(symptomsLower)) {
    relevant.push('diff_derm');
  }
  if (/fever|infect|swell/.test(symptomsLower)) {
    relevant.push('diff_id');
  }

  return relevant;
}
