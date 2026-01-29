/**
 * HELIOS Medical Triage System - Type Definitions
 *
 * Comprehensive types for:
 * - OLDCARTS symptom collection framework
 * - ESI (Emergency Severity Index) triage
 * - ICD-10 diagnosis codes
 * - Multi-agent Grand Rounds debate protocol
 * - Consensus building with Kendall's W
 * - SOAP note generation
 * - Provider booking and geolocation
 */

// ============================================
// CORE LANGUAGE AND STATUS TYPES
// ============================================

/** Supported languages for the triage system */
export type Language = 'en' | 'es' | 'fr';

/** Session status workflow */
export type SessionStatus =
  | 'intake'      // Initial symptom collection
  | 'assessment'  // OLDCARTS + history gathering
  | 'debate'      // Grand Rounds multi-agent discussion
  | 'consensus'   // Building final diagnosis agreement
  | 'complete'    // Session finished
  | 'escalated'   // Urgent care needed
  | 'cancelled';  // Session abandoned

/** Message role in conversation */
export type MessageRole = 'user' | 'assistant' | 'system';

// ============================================
// OLDCARTS FRAMEWORK
// ============================================

/**
 * Individual OLDCARTS field with collection metadata
 * Used for tracking symptom collection progress
 */
export interface OLDCARTSField {
  /** The collected value (string for most, number for severity) */
  value: string | number | null;
  /** Whether this field has been adequately collected */
  complete: boolean;
  /** ISO timestamp when this field was collected */
  collectedAt?: string;
  /** Whether follow-up questions are needed */
  followUpNeeded?: boolean;
  /** Raw user response for reference */
  rawResponse?: string;
}

/**
 * Severity-specific OLDCARTS field (0-10 numeric scale)
 */
export interface OLDCARTSSeverityField extends OLDCARTSField {
  /** Pain/symptom severity on 0-10 scale */
  value: number | null;
  /** Severity trend: is it getting better or worse? */
  trend?: 'improving' | 'stable' | 'worsening';
}

/**
 * Complete OLDCARTS symptom collection data
 *
 * OLDCARTS Mnemonic:
 * - Onset: When did symptoms start?
 * - Location: Where is the symptom?
 * - Duration: How long does it last?
 * - Character: What does it feel like?
 * - Aggravating: What makes it worse?
 * - Relieving: What makes it better?
 * - Timing: When does it occur?
 * - Severity: How bad is it (0-10)?
 */
export interface OLDCARTSData {
  /** Chief complaint - the main reason for the visit */
  chiefComplaint: string;

  /** Onset - when symptoms started */
  onset: OLDCARTSField;

  /** Location - where the symptom is felt */
  location: OLDCARTSField;

  /** Duration - how long symptoms last */
  duration: OLDCARTSField;

  /** Character - quality/nature of the symptom */
  character: OLDCARTSField;

  /** Aggravating factors - what makes it worse */
  aggravating: OLDCARTSField;

  /** Relieving factors - what makes it better */
  relieving: OLDCARTSField;

  /** Timing - pattern/frequency of symptoms */
  timing: OLDCARTSField;

  /** Severity - 0-10 pain/symptom scale */
  severity: OLDCARTSSeverityField;

  /**
   * Weighted completeness percentage (0-100)
   * Formula:
   * - Essential (onset, location, severity): 15% each = 45%
   * - Important (character, duration, timing): 12% each = 36%
   * - Supporting (aggravating, relieving): 9.5% each = 19%
   */
  completenessPercentage: number;

  /** Associated symptoms mentioned */
  associatedSymptoms?: string[];

  /** Previous episodes of similar symptoms */
  previousEpisodes?: string;
}

/**
 * OLDCARTS component weights for completeness calculation
 */
export const OLDCARTS_WEIGHTS = {
  // Essential (45% total)
  onset: 0.15,
  location: 0.15,
  severity: 0.15,
  // Important (36% total)
  character: 0.12,
  duration: 0.12,
  timing: 0.12,
  // Supporting (19% total)
  aggravating: 0.095,
  relieving: 0.095,
} as const;

// ============================================
// ESI TRIAGE
// ============================================

/**
 * Emergency Severity Index levels (1-5)
 * 1 = Resuscitation (immediate life-saving intervention)
 * 2 = Emergent (high risk, confused/lethargic, severe pain)
 * 3 = Urgent (stable but needs multiple resources)
 * 4 = Less Urgent (stable, needs one resource)
 * 5 = Non-urgent (stable, no resources needed)
 */
export type ESILevel = 1 | 2 | 3 | 4 | 5;

/**
 * ESI decision point results
 * Based on ESI v4 algorithm decision tree
 */
export interface ESIDecisionPoints {
  /** Decision Point A: Does patient require immediate life-saving intervention? */
  A_lifeSavingRequired: boolean;

  /** Decision Point B: Is this a high-risk situation? (confused, lethargic, disoriented, severe pain/distress) */
  B_highRisk: boolean;

  /** Decision Point C: How many resources are predicted? */
  C_resourcesPredicted: 0 | 1 | 2;

  /** Decision Point D: Are vital signs abnormal for age? (only for ESI 3-5) */
  D_vitalSignsAbnormal: boolean;
}

/**
 * ESI resource categories for resource prediction
 */
export type ESIResource =
  | 'labs'
  | 'ekg'
  | 'xray'
  | 'ct'
  | 'mri'
  | 'ultrasound'
  | 'iv_fluids'
  | 'iv_medications'
  | 'specialty_consult'
  | 'procedure'
  | 'simple_wound_care';

/**
 * Complete ESI assessment result
 */
export interface ESIAssessment {
  /** Final ESI level (1-5) */
  level: ESILevel;

  /** Decision point evaluations */
  decisionPoints: ESIDecisionPoints;

  /** Red flags that were identified */
  redFlagsPresent: string[];

  /** Resources expected to be needed */
  resourcesExpected: ESIResource[];

  /** Clinical reasoning for the ESI level */
  reasoning: string;

  /** Confidence in the assessment (0-1) */
  confidence: number;

  /** Recommended disposition */
  disposition?: 'ED' | 'urgent_care' | 'pcp_24h' | 'pcp_routine' | 'self_care' | 'telemedicine';

  /** Maximum wait time recommendation in minutes */
  maxWaitTimeMinutes?: number;
}

/**
 * ESI-specific red flags that trigger escalation
 */
export const ESI_RED_FLAGS = {
  level1: [
    'unresponsive',
    'apnea',
    'pulseless',
    'severe respiratory distress',
    'intubated',
  ],
  level2: [
    'chest pain with cardiac history',
    'severe abdominal pain',
    'altered mental status',
    'suicidal ideation with plan',
    'stroke symptoms',
    'severe allergic reaction',
    'high-risk pregnancy complication',
  ],
} as const;

// ============================================
// ICD-10 INTEGRATION
// ============================================

/**
 * ICD-10 diagnosis code with validation status
 */
export interface ICD10Code {
  /** ICD-10-CM code (e.g., "J06.9") */
  code: string;

  /** Official code name/description */
  name: string;

  /** Confidence in code accuracy (0-1) */
  confidence: number;

  /** Whether code was validated against NLM Clinical Tables API */
  validated: boolean;

  /** Category/chapter of the code */
  category?: string;

  /** Whether this is a billable code */
  billable?: boolean;
}

/**
 * Ranked differential diagnosis entry
 */
export interface DifferentialDiagnosis {
  /** Ranking position (1 = most likely) */
  rank: number;

  /** Human-readable diagnosis name */
  diagnosis: string;

  /** Validated ICD-10 code */
  icd10: ICD10Code;

  /** Confidence in this diagnosis (0-1) */
  confidence: number;

  /** Clinical reasoning for this diagnosis */
  reasoning: string;

  /** Evidence supporting this diagnosis */
  supportingEvidence: string[];

  /** Evidence against this diagnosis */
  refutingEvidence?: string[];

  /** Whether this is a "must not miss" diagnosis */
  mustNotMiss?: boolean;

  /** Urgency if this diagnosis is correct */
  urgency?: 'emergent' | 'urgent' | 'routine';
}

// ============================================
// GRAND ROUNDS - MULTI-AGENT DEBATE
// ============================================

/**
 * Specialist agent types for Grand Rounds
 */
export type SpecialistType =
  | 'internist'
  | 'cardiologist'
  | 'pulmonologist'
  | 'gastroenterologist'
  | 'neurologist'
  | 'psychiatrist'
  | 'emergency_medicine'
  | 'infectious_disease'
  | 'oncologist'
  | 'endocrinologist'
  | 'rheumatologist'
  | 'dermatologist'
  | 'urologist'
  | 'nephrologist'
  | 'hematologist'
  | 'pediatrician'
  | 'obgyn'
  | 'orthopedist';

/**
 * Individual agent opinion in Grand Rounds debate
 */
export interface AgentOpinion {
  /** Unique agent identifier */
  agentId: string;

  /** Agent's clinical role */
  agentRole: string;

  /** Specialist type */
  specialistType?: SpecialistType;

  /** Which debate round this opinion is from */
  debateRound: number;

  /** Agent's differential diagnosis (ranked) */
  differentialDiagnosis: DifferentialDiagnosis[];

  /** Overall confidence in assessment (0-1) */
  confidenceScore: number;

  /** Clinical concerns raised */
  concerns: string[];

  /** Evidence supporting the assessment */
  supportingEvidence: string[];

  /** Dissenting opinion if disagreeing with emerging consensus */
  dissentingOpinion?: string;

  /** Which agent this is responding to (for multi-round debate) */
  respondingToAgentId?: string;

  /** Response reasoning */
  responseReasoning?: string;

  /** Processing metrics */
  processingTimeMs?: number;
  tokenCount?: number;

  /** Timestamp */
  createdAt: string;
}

/**
 * Voting algorithm types for consensus building
 */
export type VotingAlgorithm =
  | 'kendall_w'            // Kendall's coefficient of concordance
  | 'confidence_weighted'  // Weight by agent confidence
  | 'borda_count'          // Borda count voting
  | 'majority';            // Simple majority

/**
 * Plan of action recommended by consensus
 */
export interface PlanOfAction {
  /** Recommended lab tests */
  labTests: string[];

  /** Recommended imaging studies */
  imaging: string[];

  /** Recommended specialist referrals */
  referrals: string[];

  /** Recommended medications (not prescriptions, suggestions only) */
  medications?: string[];

  /** Patient education topics */
  patientEducation?: string[];

  /** Follow-up recommendations */
  followUp?: string;

  /** Red flag warnings for patient */
  redFlagWarnings?: string[];
}

/**
 * Final consensus result after Grand Rounds debate
 */
export interface ConsensusResult {
  /**
   * Kendall's W coefficient of concordance (0-1)
   * - 0.0-0.3: Weak agreement
   * - 0.3-0.5: Moderate agreement
   * - 0.5-0.7: Good agreement
   * - 0.7-1.0: Strong agreement (target threshold)
   */
  kendallW: number;

  /** Whether consensus was successfully reached */
  consensusReached: boolean;

  /** Number of debate rounds required */
  roundsRequired: number;

  /** List of participating agent IDs */
  participatingAgents: string[];

  /** Primary/most likely diagnosis */
  primaryDiagnosis: DifferentialDiagnosis;

  /** Full differential diagnosis list (ranked) */
  differentialDiagnosis: DifferentialDiagnosis[];

  /** Recommended plan of action */
  planOfAction: PlanOfAction;

  /** Any dissenting opinions for transparency */
  dissentingOpinions?: AgentOpinion[];

  /** Final ESI level after consensus */
  finalEsiLevel?: ESILevel;

  /** Whether human physician review is required */
  humanReviewRequired: boolean;

  /** Reason for human review requirement */
  humanReviewReason?: string;

  /** Recommended disposition */
  disposition?: string;

  /** Timestamp */
  createdAt: string;
}

// ============================================
// SOAP NOTES
// ============================================

/**
 * Patient demographics for SOAP note
 */
export interface PatientDemographics {
  age?: number;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  preferredLanguage: Language;
  occupation?: string;
}

/**
 * Allergy entry with reaction details
 */
export interface AllergyEntry {
  /** The allergen (medication, food, environmental) */
  allergen: string;
  /** Type of reaction */
  reaction: string;
  /** Severity of reaction */
  severity?: 'mild' | 'moderate' | 'severe' | 'life_threatening';
}

/**
 * Vital signs (self-reported or measured)
 */
export interface VitalSigns {
  /** Temperature in Fahrenheit */
  temperature?: number;
  /** Heart rate in BPM */
  heartRate?: number;
  /** Respiratory rate per minute */
  respiratoryRate?: number;
  /** Blood pressure as "systolic/diastolic" */
  bloodPressure?: string;
  /** Oxygen saturation percentage */
  spO2?: number;
  /** Weight in pounds */
  weight?: number;
  /** Height in inches */
  height?: number;
  /** Pain level 0-10 */
  painLevel?: number;
}

/**
 * Review of Systems (ROS) organized by body system
 */
export interface ReviewOfSystems {
  constitutional?: string[];
  eyes?: string[];
  ears_nose_throat?: string[];
  cardiovascular?: string[];
  respiratory?: string[];
  gastrointestinal?: string[];
  genitourinary?: string[];
  musculoskeletal?: string[];
  skin?: string[];
  neurological?: string[];
  psychiatric?: string[];
  endocrine?: string[];
  hematologic?: string[];
  allergic_immunologic?: string[];
}

/**
 * Subjective section of SOAP note
 */
export interface SOAPSubjective {
  /** Patient demographics */
  demographics: PatientDemographics;

  /** Chief complaint - reason for visit */
  chiefComplaint: string;

  /** History of Present Illness (incorporates OLDCARTS) */
  hpi: string;

  /** Current medications */
  medications: string[];

  /** Known allergies with reactions */
  allergies: AllergyEntry[];

  /** Social history (smoking, alcohol, drugs, occupation, living situation) */
  socialHistory?: string;

  /** Family medical history */
  familyHistory?: string;

  /** Past medical history */
  pastMedicalHistory?: string[];

  /** Past surgical history */
  pastSurgicalHistory?: string[];

  /** Review of systems */
  reviewOfSystems?: ReviewOfSystems;
}

/**
 * Objective section of SOAP note
 */
export interface SOAPObjective {
  /** Vital signs (self-reported or measured) */
  vitalSigns?: VitalSigns;

  /** Self-reported physical findings */
  selfReportedFindings: string[];

  /** General appearance notes */
  generalAppearance?: string;

  /** Any physical exam notes (if telehealth) */
  physicalExamNotes?: string;
}

/**
 * Assessment section of SOAP note
 */
export interface SOAPAssessment {
  /** Summary statement of the case */
  summaryStatement: string;

  /** Active problem list */
  problemList: string[];

  /** Differential diagnosis with ICD-10 codes */
  differentialDiagnosis: DifferentialDiagnosis[];

  /** Clinical reasoning explanation */
  clinicalReasoning: string;

  /** ESI triage level */
  esiLevel?: ESILevel;

  /** ESI reasoning */
  esiReasoning?: string;
}

/**
 * Plan section of SOAP note
 */
export interface SOAPPlan {
  /** Recommended diagnostic tests */
  diagnostics: string[];

  /** Recommended treatments (not prescriptions) */
  treatments: string[];

  /** Recommended specialist referrals */
  referrals: string[];

  /** Patient education points */
  patientEducation: string;

  /** Follow-up recommendations */
  followUp: string;

  /** Red flag warnings - when to seek immediate care */
  redFlagWarnings?: string[];

  /** Lifestyle modifications */
  lifestyleModifications?: string[];
}

/**
 * Complete SOAP note structure
 */
export interface SOAPNote {
  /** Subjective - patient-reported information */
  subjective: SOAPSubjective;

  /** Objective - observable/measurable findings */
  objective: SOAPObjective;

  /** Assessment - clinical interpretation */
  assessment: SOAPAssessment;

  /** Plan - recommended actions */
  plan: SOAPPlan;

  /** PDF URL if generated */
  pdfUrl?: string;

  /** Version number for tracking edits */
  version: number;

  /** Timestamps */
  createdAt: string;
  updatedAt: string;
}

// ============================================
// TRIAGE SESSION
// ============================================

/**
 * Conversation message in triage session
 */
export interface TriageMessage {
  /** Unique message ID */
  id: string;

  /** Message role */
  role: MessageRole;

  /** Message content */
  content: string;

  /** Language of the message */
  language: Language;

  /** ISO timestamp */
  timestamp: string;

  /** Whether this message was about a specific OLDCARTS component */
  oldcartsComponent?: keyof Omit<OLDCARTSData, 'chiefComplaint' | 'completenessPercentage' | 'associatedSymptoms' | 'previousEpisodes'>;

  /** Any extracted clinical entities */
  extractedEntities?: {
    symptoms?: string[];
    medications?: string[];
    conditions?: string[];
    timeframes?: string[];
  };
}

/**
 * Complete triage session state
 */
export interface TriageSession {
  /** Unique session ID */
  id: string;

  /** Patient/user ID (optional for anonymous) */
  patientId?: string;

  /** Session language */
  language: Language;

  /** Current ESI level (if assessed) */
  esiLevel?: ESILevel;

  /** ESI reasoning */
  esiReasoning?: string;

  /** Full ESI assessment */
  esiAssessment?: ESIAssessment;

  /** Current session status */
  status: SessionStatus;

  /** OLDCARTS symptom collection data */
  oldcarts: OLDCARTSData;

  /** Conversation history */
  conversationHistory: TriageMessage[];

  /** Agent opinions from Grand Rounds */
  agentOpinions?: AgentOpinion[];

  /** Final consensus result */
  consensus?: ConsensusResult;

  /** Generated SOAP note */
  soapNote?: SOAPNote;

  /** Link to helios_sessions table */
  heliosSessionId?: string;

  /** Timestamps */
  createdAt: string;
  updatedAt: string;
  completedAt?: string;

  /** Metadata for extensibility */
  metadata?: Record<string, unknown>;
}

// ============================================
// CONFIGURATION TYPES
// ============================================

/**
 * Conditions that trigger transition to assessment phase
 */
export interface AssessmentTriggers {
  /** Minimum OLDCARTS completeness to trigger (default 50%) */
  oldcartsCompletenessThreshold: number;

  /** Minimum message count to trigger (default 6) */
  messageCountThreshold: number;

  /** Red flags that immediately escalate */
  emergencyRedFlags: string[];

  /** Keywords that suggest assessment is ready */
  readinessKeywords?: string[];
}

/**
 * Individual specialist agent configuration
 */
export interface SpecialistConfig {
  /** Unique agent ID */
  id: string;

  /** Display role name */
  role: string;

  /** Specialist type */
  type: SpecialistType;

  /** System prompt for this specialist */
  systemPrompt: string;

  /** Model to use (opus, sonnet, haiku) */
  model: 'opus' | 'sonnet' | 'haiku';

  /** Symptom weights for relevance scoring */
  symptomWeights: Record<string, number>;

  /** Keywords that activate this specialist */
  activationKeywords?: string[];

  /** Whether this specialist is always included */
  alwaysInclude?: boolean;
}

/**
 * Grand Rounds debate configuration
 */
export interface GrandRoundsConfig {
  /** Maximum debate rounds before forcing consensus (default 3) */
  maxRounds: number;

  /** Kendall's W threshold for consensus (default 0.7) */
  consensusThreshold: number;

  /** Minimum specialists required for valid consensus */
  minSpecialists: number;

  /** Available specialist configurations */
  specialists: SpecialistConfig[];

  /** Voting algorithm to use */
  votingAlgorithm: VotingAlgorithm;

  /** Whether to always require human review */
  alwaysRequireHumanReview?: boolean;

  /** Timeout for each agent response in ms */
  agentTimeoutMs?: number;
}

/**
 * Complete triage system configuration
 */
export interface TriageSystemConfig {
  /** Default language */
  defaultLanguage: Language;

  /** Assessment phase triggers */
  assessmentTriggers: AssessmentTriggers;

  /** Grand Rounds configuration */
  grandRounds: GrandRoundsConfig;

  /** ICD-10 API configuration */
  icd10: {
    apiEndpoint: string;
    cacheTtlMinutes: number;
  };

  /** Escalation settings */
  escalation: {
    autoEscalateEsi1: boolean;
    autoEscalateEsi2: boolean;
    requireHumanReviewForEsi2: boolean;
  };
}

// ============================================
// PROVIDER AND BOOKING TYPES
// ============================================

/**
 * Healthcare provider for booking
 */
export interface Provider {
  id: string;
  name: string;
  specialty: string;
  credentials?: string;
  facilityName?: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  distanceMiles?: number;
  videoVisitAvailable: boolean;
  videoVisitPrice?: number;
  rating?: number;
  reviewCount?: number;
  nextAvailableSlot?: string;
  acceptsSameDay?: boolean;
  languages?: string[];
  insuranceNetworks?: string[];
}

/**
 * Appointment booking request
 */
export interface BookingRequest {
  sessionId: string;
  providerId: string;
  patientId?: string;
  appointmentType: 'video' | 'in_person' | 'phone';
  scheduledAt: string;
  chiefComplaint?: string;
  includeSOAPNote?: boolean;
  paymentMethod?: string;
}

/**
 * Appointment booking result
 */
export interface BookingResult {
  success: boolean;
  appointmentId?: string;
  confirmationCode?: string;
  videoRoomUrl?: string;
  error?: string;
}

/**
 * User feedback entry
 */
export interface UserFeedback {
  sessionId: string;
  feedbackType: 'overall' | 'diagnosis' | 'communication' | 'recommendation' | 'booking';
  rating: 'not_helpful' | 'so_so' | 'helpful';
  feedbackText?: string;
  issues?: string[];
}

// ============================================
// API RESPONSE TYPES
// ============================================

/**
 * Generic API response wrapper
 */
export interface TriageApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Session creation response
 */
export interface CreateSessionResponse {
  sessionId: string;
  greeting: string;
  phase: SessionStatus;
}

/**
 * Message response from chat
 */
export interface ChatResponse {
  message: string;
  phase: SessionStatus;
  oldcartsCompleteness: number;
  intakeRequired?: boolean;
  redFlags?: string[];
  escalated?: boolean;
  uiTriggers?: {
    showAssessment: boolean;
    showBooking: boolean;
    showEmergency: boolean;
    showSummary: boolean;
  };
  soapNote?: string;
}

/**
 * Session completion response
 */
export interface CompleteSessionResponse {
  success: boolean;
  summary?: string;
  soapNote?: SOAPNote;
  consensus?: ConsensusResult;
  recommendedProviders?: Provider[];
}

// ============================================
// UTILITY TYPES
// ============================================

/**
 * Calculate OLDCARTS completeness from data
 */
export function calculateOLDCARTSCompleteness(data: Partial<OLDCARTSData>): number {
  let score = 0;

  if (data.onset?.complete) score += OLDCARTS_WEIGHTS.onset;
  if (data.location?.complete) score += OLDCARTS_WEIGHTS.location;
  if (data.severity?.complete) score += OLDCARTS_WEIGHTS.severity;
  if (data.character?.complete) score += OLDCARTS_WEIGHTS.character;
  if (data.duration?.complete) score += OLDCARTS_WEIGHTS.duration;
  if (data.timing?.complete) score += OLDCARTS_WEIGHTS.timing;
  if (data.aggravating?.complete) score += OLDCARTS_WEIGHTS.aggravating;
  if (data.relieving?.complete) score += OLDCARTS_WEIGHTS.relieving;

  return Math.round(score * 100);
}

/**
 * Create empty OLDCARTS data structure
 */
export function createEmptyOLDCARTS(chiefComplaint: string): OLDCARTSData {
  const emptyField: OLDCARTSField = { value: null, complete: false };

  return {
    chiefComplaint,
    onset: { ...emptyField },
    location: { ...emptyField },
    duration: { ...emptyField },
    character: { ...emptyField },
    aggravating: { ...emptyField },
    relieving: { ...emptyField },
    timing: { ...emptyField },
    severity: { value: null, complete: false },
    completenessPercentage: 0,
  };
}

/**
 * Get ESI level description
 */
export function getESIDescription(level: ESILevel): string {
  const descriptions: Record<ESILevel, string> = {
    1: 'Resuscitation - Immediate life-saving intervention required',
    2: 'Emergent - High risk, severe pain, or altered mental status',
    3: 'Urgent - Stable, but needs multiple resources',
    4: 'Less Urgent - Stable, needs one resource',
    5: 'Non-urgent - Stable, no resources needed',
  };
  return descriptions[level];
}

/**
 * Check if Kendall's W indicates consensus
 */
export function isConsensusReached(kendallW: number, threshold = 0.7): boolean {
  return kendallW >= threshold;
}
