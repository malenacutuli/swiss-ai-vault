import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.24.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ============================================
// CONFIGURATION
// ============================================

// Use edge function for orchestration (bypasses K8s connectivity issues)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://ghmmdochvlrnwbruyrqk.supabase.co";
const GRAND_ROUNDS_API_URL = Deno.env.get("GRAND_ROUNDS_API_URL") || `${SUPABASE_URL}/functions/v1/helios-orchestrator`;
const GRAND_ROUNDS_API_KEY = Deno.env.get("GRAND_ROUNDS_API_KEY") || "";
// Use service role for internal edge function calls
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// ============================================
// DEV PROJECT SYNC (Dual-Write for Redundancy)
// ============================================

const DEV_SUPABASE_URL = "https://ghmmdochvlrnwbruyrqk.supabase.co";
const DEV_SUPABASE_SERVICE_KEY = Deno.env.get("DEV_SUPABASE_SERVICE_ROLE_KEY");

function getDevSupabase(): SupabaseClient | null {
  if (!DEV_SUPABASE_SERVICE_KEY) {
    return null;
  }
  return createClient(DEV_SUPABASE_URL, DEV_SUPABASE_SERVICE_KEY);
}

async function syncToDevProject(
  devSupabase: SupabaseClient | null,
  table: string,
  operation: 'insert' | 'update',
  data: Record<string, unknown>,
  matchColumn?: string,
  matchValue?: string
): Promise<void> {
  if (!devSupabase) return;

  try {
    if (operation === 'insert') {
      await devSupabase.from(table).insert(data);
    } else if (operation === 'update' && matchColumn && matchValue) {
      await devSupabase.from(table).update(data).eq(matchColumn, matchValue);
    }
  } catch (err) {
    console.error(`[HELIOS] Dev sync failed for ${table}:`, err);
  }
}

// ============================================
// TYPES
// ============================================

type Phase = 'intake' | 'chief_complaint' | 'history_taking' | 'triage' | 'differential' | 'plan' | 'documentation' | 'completed' | 'escalated' | 'prescription_refill' | 'prescription_new';
type Severity = 'low' | 'moderate' | 'high' | 'critical';
type EscalationLevel = 'emergency' | 'urgent' | 'flag_only';
type TriageLevel = 1 | 2 | 3 | 4 | 5;
type Language = 'en' | 'es' | 'fr';

// ============================================
// PRESCRIPTION FLOW TYPES
// ============================================

type PrescriptionFlowType = 'refill' | 'new' | null;

interface PrescriptionFlowStep {
  step: number;
  question: string;
  field: string;
  inputType?: 'text' | 'buttons' | 'file';
  buttons?: Array<{ label: string; value: string }>;
  placeholder?: string;
}

interface PrescriptionFlowState {
  type: PrescriptionFlowType;
  currentStep: number;
  data: Record<string, string | boolean>;
}

// Refill flow steps
const REFILL_FLOW_STEPS: PrescriptionFlowStep[] = [
  {
    step: 0,
    question: "Have you taken this medication before?",
    field: "previously_taken",
    inputType: "buttons",
    buttons: [
      { label: "Yes, I've taken it before", value: "yes" },
      { label: "No, this is new to me", value: "no" }
    ]
  },
  {
    step: 1,
    question: "What is the name of the medication you need refilled?",
    field: "medication_name",
    inputType: "text",
    placeholder: "e.g., Lisinopril, Metformin, Atorvastatin"
  },
  {
    step: 2,
    question: "What dosage are you currently taking?",
    field: "dosage",
    inputType: "text",
    placeholder: "e.g., 10mg, 500mg, 20mg"
  },
  {
    step: 3,
    question: "How often do you take this medication?",
    field: "frequency",
    inputType: "buttons",
    buttons: [
      { label: "Once daily", value: "once_daily" },
      { label: "Twice daily", value: "twice_daily" },
      { label: "Three times daily", value: "three_times_daily" },
      { label: "As needed", value: "as_needed" },
      { label: "Other", value: "other" }
    ]
  },
  {
    step: 4,
    question: "Do you have a copy of your current prescription or medication bottle? If so, please upload a photo.",
    field: "prescription_photo",
    inputType: "buttons",
    buttons: [
      { label: "📷 Upload Photo", value: "upload_photo" },
      { label: "I don't have one", value: "no_photo" }
    ]
  },
  {
    step: 5,
    question: "What is the name of the doctor who originally prescribed this medication?",
    field: "prescribing_doctor",
    inputType: "text",
    placeholder: "Dr. Smith, Dr. Johnson, etc."
  },
  {
    step: 6,
    question: "Please provide your full legal name for the prescription.",
    field: "patient_name",
    inputType: "text",
    placeholder: "First and Last Name"
  },
  {
    step: 7,
    question: "What is your date of birth?",
    field: "date_of_birth",
    inputType: "text",
    placeholder: "MM/DD/YYYY"
  },
  {
    step: 8,
    question: "What is your current address for the prescription?",
    field: "address",
    inputType: "text",
    placeholder: "Street Address, City, State, ZIP"
  }
];

// New prescription flow steps (starts with symptom collection, then patient info)
const NEW_RX_INITIAL_STEPS: PrescriptionFlowStep[] = [
  {
    step: 0,
    question: "I'll help you request a new prescription. First, let me understand your symptoms. What health concern brings you here today?",
    field: "chief_complaint",
    inputType: "text",
    placeholder: "Describe your symptoms..."
  }
];

const NEW_RX_PATIENT_INFO_STEPS: PrescriptionFlowStep[] = [
  {
    step: 100,
    question: "Thank you for sharing that information. To proceed with the prescription request, please provide your full legal name.",
    field: "patient_name",
    inputType: "text",
    placeholder: "First and Last Name"
  },
  {
    step: 101,
    question: "What is your date of birth?",
    field: "date_of_birth",
    inputType: "text",
    placeholder: "MM/DD/YYYY"
  },
  {
    step: 102,
    question: "What is your current address?",
    field: "address",
    inputType: "text",
    placeholder: "Street Address, City, State, ZIP"
  }
];

function detectPrescriptionIntent(message: string): PrescriptionFlowType {
  const lowerMessage = message.toLowerCase();
  
  const refillKeywords = [
    'prescription refill', 'refill prescription', 'refill my', 'need refill',
    'medication refill', 'refill medication', 'renew prescription', 'renew my',
    'refill request', 'refill_prescription', 'prescription_refill'
  ];
  
  const newRxKeywords = [
    'new prescription', 'need prescription', 'get prescription', 'prescription for',
    'new medication', 'need medication', 'new_prescription', 'prescription_new'
  ];
  
  if (refillKeywords.some(kw => lowerMessage.includes(kw))) {
    return 'refill';
  }
  
  if (newRxKeywords.some(kw => lowerMessage.includes(kw))) {
    return 'new';
  }
  
  return null;
}

function getNextPrescriptionStep(
  flowState: PrescriptionFlowState,
  language: Language
): { message: string; buttons?: Array<{ label: string; value: string }>; inputType?: string; placeholder?: string; isComplete: boolean } {
  const steps = flowState.type === 'refill' ? REFILL_FLOW_STEPS : 
                flowState.currentStep >= 100 ? NEW_RX_PATIENT_INFO_STEPS :
                NEW_RX_INITIAL_STEPS;
  
  const currentStep = steps.find(s => s.step === flowState.currentStep);
  
  if (!currentStep) {
    // Flow complete
    const frequencyVal = flowState.data.frequency;
    const frequencyDisplay = typeof frequencyVal === 'string' ? frequencyVal.replace('_', ' ') : 'Not specified';
    
    return {
      message: flowState.type === 'refill' 
        ? "Thank you! I have all the information needed for your prescription refill request. Here's a summary of your request:\n\n" +
          `**Medication:** ${flowState.data.medication_name || 'Not specified'}\n` +
          `**Dosage:** ${flowState.data.dosage || 'Not specified'}\n` +
          `**Frequency:** ${frequencyDisplay}\n` +
          `**Prescribing Doctor:** ${flowState.data.prescribing_doctor || 'Not specified'}\n\n` +
          "A licensed physician will review your request. They may approve it, request more information, or schedule a brief video consultation.\n\n" +
          "Would you like to proceed to payment to submit your refill request?"
        : "Thank you! Based on your symptoms and information, a licensed physician will review your case. They may:\n\n" +
          "• Approve a prescription if appropriate\n" +
          "• Request additional information\n" +
          "• Schedule a video consultation\n\n" +
          "**Important:** Prescription decisions are made by licensed physicians, not AI.\n\n" +
          "Would you like to proceed to payment to submit your request?",
      buttons: [
        { label: "Proceed to Payment", value: "proceed_payment" },
        { label: "Cancel Request", value: "cancel_request" }
      ],
      isComplete: true
    };
  }
  
  return {
    message: currentStep.question,
    buttons: currentStep.buttons,
    inputType: currentStep.inputType,
    placeholder: currentStep.placeholder,
    isComplete: false
  };
}

function processRefillFlowStep(
  flowState: PrescriptionFlowState,
  userMessage: string
): PrescriptionFlowState {
  const steps = REFILL_FLOW_STEPS;
  const currentStep = steps.find(s => s.step === flowState.currentStep);
  
  if (!currentStep) return flowState;
  
  // Store the response
  const newData = { ...flowState.data, [currentStep.field]: userMessage };
  
  // Special handling for "no" on first question
  if (currentStep.step === 0 && userMessage.toLowerCase() === 'no') {
    // Redirect to new prescription flow
    return {
      type: 'new',
      currentStep: 0,
      data: {}
    };
  }
  
  // Move to next step
  return {
    ...flowState,
    currentStep: flowState.currentStep + 1,
    data: newData
  };
}

interface RedFlag {
  flag_id: string;
  rule_id: string;
  flag_type: string;
  description: string;
  severity: Severity;
  escalation_level: EscalationLevel;
  action_taken: string;
  detected_at: string;
}

interface OLDCARTSField {
  value: string | number | null;
  complete: boolean;
  collectedAt?: string;
}

interface OLDCARTSData {
  chiefComplaint: string;
  onset: OLDCARTSField;
  location: OLDCARTSField;
  duration: OLDCARTSField;
  character: OLDCARTSField;
  aggravating: OLDCARTSField;
  relieving: OLDCARTSField;
  timing: OLDCARTSField;
  severity: OLDCARTSField & { value: number | null };
  completenessPercentage: number;
  associatedSymptoms: string[];
}

interface PatientState {
  age?: number;
  ageUnit?: 'years' | 'months' | 'days';
  sex?: 'male' | 'female' | 'other';
  pregnant?: boolean;
  symptoms: string[];
  riskFactors: string[];
  medications: string[];
  messages: string[];
}

interface ConsensusResult {
  kendallW: number;
  consensusReached: boolean;
  roundsRequired: number;
  participatingAgents: string[];
  primaryDiagnosis: {
    diagnosis: string;
    icd10: { code: string; name: string };
    confidence: number;
    reasoning: string;
  };
  differentialDiagnosis: Array<{
    rank: number;
    diagnosis: string;
    icd10: { code: string; name: string };
    confidence: number;
    reasoning: string;
  }>;
  planOfAction: {
    labTests: string[];
    imaging: string[];
    referrals: string[];
    medications: string[];
    patientEducation: string[];
    followUp: string;
    redFlagWarnings: string[];
  };
  finalEsiLevel?: TriageLevel;
  humanReviewRequired: boolean;
  humanReviewReason?: string;
  disposition?: string;
}

interface SafetyCheckResult {
  triggered: boolean;
  redFlags: RedFlag[];
  requiresEscalation: boolean;
  escalationReason?: string;
  highestSeverity?: Severity;
}

// OrchestrationResponse from helios-orchestrator service
interface OrchestrationResponse {
  session_id: string;
  consensus: {
    kendall_w: number;
    consensus_reached: boolean;
    rounds_required: number;
    participating_agents: string[];
    primary_diagnosis: {
      diagnosis: string;
      icd10_code: string;
      icd10_name: string;
      confidence: number;
      reasoning: string;
    };
    differential_diagnoses: Array<{
      rank: number;
      diagnosis: string;
      icd10_code: string;
      icd10_name: string;
      confidence: number;
      reasoning: string;
    }>;
    dissenting_opinions?: Array<{
      agent_id: string;
      diagnosis: string;
      reasoning: string;
    }>;
  };
  triage: {
    esi_level: TriageLevel;
    disposition: string;
    reasoning: string;
    human_review_required: boolean;
    human_review_reason?: string;
  };
  plan: {
    lab_tests: string[];
    imaging: string[];
    referrals: string[];
    medications: string[];
    patient_education: string[];
    follow_up: string;
    red_flag_warnings: string[];
  };
  safety: {
    critical_finding: boolean;
    immediate_action?: string;
    red_flags: Array<{
      category: string;
      description: string;
      severity: Severity;
    }>;
  };
  soap_note: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  processing_time_ms: number;
}

// ============================================
// OLDCARTS WEIGHTS (Essential 45%, Important 36%, Supporting 19%)
// ============================================

const OLDCARTS_WEIGHTS = {
  onset: 15,      // Essential
  location: 15,   // Essential
  severity: 15,   // Essential
  character: 12,  // Important
  duration: 12,   // Important
  aggravating: 9.5, // Important
  relieving: 9.5,   // Important
  timing: 12,     // Supporting
};

function createEmptyOLDCARTS(chiefComplaint: string): OLDCARTSData {
  return {
    chiefComplaint,
    onset: { value: null, complete: false },
    location: { value: null, complete: false },
    duration: { value: null, complete: false },
    character: { value: null, complete: false },
    aggravating: { value: null, complete: false },
    relieving: { value: null, complete: false },
    timing: { value: null, complete: false },
    severity: { value: null, complete: false },
    completenessPercentage: 0,
    associatedSymptoms: [],
  };
}

function calculateOLDCARTSProgress(data: OLDCARTSData): number {
  let score = 0;
  if (data.onset.complete) score += OLDCARTS_WEIGHTS.onset;
  if (data.location.complete) score += OLDCARTS_WEIGHTS.location;
  if (data.severity.complete) score += OLDCARTS_WEIGHTS.severity;
  if (data.character.complete) score += OLDCARTS_WEIGHTS.character;
  if (data.duration.complete) score += OLDCARTS_WEIGHTS.duration;
  if (data.aggravating.complete) score += OLDCARTS_WEIGHTS.aggravating;
  if (data.relieving.complete) score += OLDCARTS_WEIGHTS.relieving;
  if (data.timing.complete) score += OLDCARTS_WEIGHTS.timing;
  return Math.min(100, score);
}

// ============================================
// DETERMINISTIC SAFETY RULES (NO LLM)
// ============================================

const SAFETY_RULES = [
  // CARDIAC
  {
    ruleId: 'cardiac_001',
    name: { en: 'Chest Pain with Risk Factors', es: 'Dolor Torácico con Factores de Riesgo', fr: 'Douleur Thoracique avec Facteurs de Risque' },
    category: 'cardiac',
    severity: 'critical' as Severity,
    escalationLevel: 'emergency' as EscalationLevel,
    keywords: ['chest pain', 'chest pressure', 'chest tightness', 'dolor de pecho', 'presión en el pecho', 'douleur thoracique'],
    riskKeywords: ['diabetes', 'hypertension', 'smoking', 'heart disease', 'diabético', 'hipertensión', 'fumador'],
    needsRiskFactor: true,
    action: { en: 'EMERGENCY: Chest pain with cardiac risk factors. Call 911 immediately.', es: 'EMERGENCIA: Dolor torácico con factores de riesgo cardíaco. Llame al 911.', fr: 'URGENCE: Douleur thoracique avec facteurs de risque. Appelez le 15.' },
  },
  {
    ruleId: 'cardiac_002',
    name: { en: 'Radiating Chest Pain', es: 'Dolor Torácico Irradiado', fr: 'Douleur Thoracique Irradiante' },
    category: 'cardiac',
    severity: 'critical' as Severity,
    escalationLevel: 'emergency' as EscalationLevel,
    keywords: ['radiating to arm', 'radiating to jaw', 'pain in left arm', 'irradia al brazo', 'irradie au bras'],
    needsRiskFactor: false,
    action: { en: 'EMERGENCY: Chest pain radiating to arm/jaw suggests cardiac event. Call 911.', es: 'EMERGENCIA: Dolor torácico que irradia sugiere evento cardíaco. Llame al 911.', fr: 'URGENCE: Douleur thoracique irradiante suggère événement cardiaque. Appelez le 15.' },
  },
  // NEUROLOGICAL
  {
    ruleId: 'neuro_001',
    name: { en: 'Stroke Symptoms (FAST)', es: 'Síntomas de Derrame', fr: "Symptômes d'AVC" },
    category: 'neuro',
    severity: 'critical' as Severity,
    escalationLevel: 'emergency' as EscalationLevel,
    keywords: ['facial droop', 'face drooping', 'arm weakness', 'slurred speech', 'can\'t speak', 'worst headache', 'thunderclap headache', 'caída facial', 'debilidad del brazo', 'affaissement facial'],
    needsRiskFactor: false,
    action: { en: 'EMERGENCY: Possible stroke. Time is critical. Call 911 immediately.', es: 'EMERGENCIA: Posible derrame cerebral. Llame al 911 inmediatamente.', fr: 'URGENCE: AVC possible. Appelez le 15 immédiatement.' },
  },
  {
    ruleId: 'neuro_002',
    name: { en: 'Altered Mental Status', es: 'Estado Mental Alterado', fr: 'État Mental Altéré' },
    category: 'neuro',
    severity: 'critical' as Severity,
    escalationLevel: 'emergency' as EscalationLevel,
    keywords: ['confused', 'disoriented', 'loss of consciousness', 'passed out', 'unresponsive', 'confundido', 'pérdida de conciencia', 'confus', 'perte de conscience'],
    needsRiskFactor: false,
    action: { en: 'EMERGENCY: Altered mental status requires immediate evaluation. Call 911.', es: 'EMERGENCIA: Estado mental alterado requiere evaluación inmediata. Llame al 911.', fr: 'URGENCE: État mental altéré nécessite évaluation immédiate. Appelez le 15.' },
  },
  // RESPIRATORY
  {
    ruleId: 'resp_001',
    name: { en: 'Severe Respiratory Distress', es: 'Dificultad Respiratoria Severa', fr: 'Détresse Respiratoire Sévère' },
    category: 'respiratory',
    severity: 'critical' as Severity,
    escalationLevel: 'emergency' as EscalationLevel,
    keywords: ['can\'t breathe', 'cannot breathe', 'gasping', 'blue lips', 'choking', 'no puedo respirar', 'labios azules', 'ne peut pas respirer', 'lèvres bleues'],
    needsRiskFactor: false,
    action: { en: 'EMERGENCY: Severe breathing difficulty. Call 911 immediately.', es: 'EMERGENCIA: Dificultad respiratoria severa. Llame al 911.', fr: 'URGENCE: Difficulté respiratoire sévère. Appelez le 15.' },
  },
  // PSYCHIATRIC
  {
    ruleId: 'psych_001',
    name: { en: 'Suicidal Ideation', es: 'Ideación Suicida', fr: 'Idéation Suicidaire' },
    category: 'psychiatric',
    severity: 'critical' as Severity,
    escalationLevel: 'emergency' as EscalationLevel,
    keywords: ['kill myself', 'want to die', 'end my life', 'suicide', 'suicidal', 'better off dead', 'hurt myself', 'matarme', 'quiero morir', 'me tuer', 'veux mourir'],
    needsRiskFactor: false,
    action: { en: 'CRISIS: Your life matters. Please call 988 (Suicide Prevention) immediately.', es: 'CRISIS: Tu vida importa. Llama al 024 (Prevención del Suicidio).', fr: 'CRISE: Votre vie compte. Appelez le 3114 immédiatement.' },
  },
  // PEDIATRIC
  {
    ruleId: 'peds_001',
    name: { en: 'Infant Fever (<3 months)', es: 'Fiebre en Lactante', fr: 'Fièvre du Nourrisson' },
    category: 'pediatric',
    severity: 'critical' as Severity,
    escalationLevel: 'emergency' as EscalationLevel,
    keywords: ['fever', 'fiebre', 'fièvre'],
    ageCondition: { maxMonths: 3 },
    needsRiskFactor: false,
    action: { en: 'EMERGENCY: Fever in infant <3 months requires immediate ER evaluation.', es: 'EMERGENCIA: Fiebre en lactante <3 meses requiere evaluación de emergencia.', fr: 'URGENCE: Fièvre chez nourrisson <3 mois nécessite évaluation urgente.' },
  },
  // OBSTETRIC
  {
    ruleId: 'ob_001',
    name: { en: 'Pregnancy with Bleeding', es: 'Embarazo con Sangrado', fr: 'Grossesse avec Saignement' },
    category: 'obstetric',
    severity: 'critical' as Severity,
    escalationLevel: 'emergency' as EscalationLevel,
    keywords: ['bleeding', 'hemorrhage', 'sangrado', 'hemorragia', 'saignement', 'hémorragie'],
    pregnancyRequired: true,
    needsRiskFactor: false,
    action: { en: 'EMERGENCY: Bleeding during pregnancy requires immediate evaluation. Call 911.', es: 'EMERGENCIA: Sangrado durante embarazo requiere evaluación inmediata. Llame al 911.', fr: 'URGENCE: Saignement pendant grossesse nécessite évaluation immédiate. Appelez le 15.' },
  },
  // ANAPHYLAXIS
  {
    ruleId: 'allergy_001',
    name: { en: 'Anaphylaxis Symptoms', es: 'Síntomas de Anafilaxia', fr: "Symptômes d'Anaphylaxie" },
    category: 'allergy',
    severity: 'critical' as Severity,
    escalationLevel: 'emergency' as EscalationLevel,
    keywords: ['throat swelling', 'tongue swelling', 'can\'t swallow', 'hives all over', 'face swelling', 'hinchazón de garganta', 'gonflement de la gorge'],
    needsRiskFactor: false,
    action: { en: 'EMERGENCY: Severe allergic reaction. Use EpiPen if available. Call 911.', es: 'EMERGENCIA: Reacción alérgica severa. Use EpiPen si está disponible. Llame al 911.', fr: 'URGENCE: Réaction allergique sévère. Utilisez EpiPen si disponible. Appelez le 15.' },
  },
  // SEVERE BLEEDING
  {
    ruleId: 'bleed_001',
    name: { en: 'Severe Bleeding', es: 'Sangrado Severo', fr: 'Saignement Sévère' },
    category: 'bleeding',
    severity: 'critical' as Severity,
    escalationLevel: 'emergency' as EscalationLevel,
    keywords: ['won\'t stop bleeding', 'can\'t stop bleeding', 'spurting', 'a lot of blood', 'heavy bleeding', 'no para de sangrar', 'mucha sangre', 'n\'arrête pas de saigner'],
    needsRiskFactor: false,
    action: { en: 'EMERGENCY: Apply direct pressure. Call 911.', es: 'EMERGENCIA: Aplique presión directa. Llame al 911.', fr: 'URGENCE: Appliquez pression directe. Appelez le 15.' },
  },
];

function isEmergency(message: string, patientState: PatientState): SafetyCheckResult {
  const redFlags: RedFlag[] = [];
  let requiresEscalation = false;
  let escalationReason: string | undefined;
  let highestSeverity: Severity | undefined;

  const allText = [...patientState.symptoms, ...patientState.messages, message].join(' ').toLowerCase();

  for (const rule of SAFETY_RULES) {
    const hasKeyword = rule.keywords.some(k => allText.includes(k.toLowerCase()));
    if (!hasKeyword) continue;

    if (rule.needsRiskFactor && rule.riskKeywords) {
      const hasRisk = rule.riskKeywords.some(k =>
        patientState.riskFactors.some(r => r.toLowerCase().includes(k.toLowerCase())) ||
        allText.includes(k.toLowerCase())
      ) || (patientState.age && patientState.age >= 40);
      if (!hasRisk) continue;
    }

    if (rule.ageCondition) {
      const ageInMonths = patientState.ageUnit === 'months' ? patientState.age :
                         patientState.ageUnit === 'days' ? (patientState.age || 0) / 30 :
                         (patientState.age || 999) * 12;
      if ((ageInMonths ?? 999) > (rule.ageCondition.maxMonths || 999)) continue;
    }

    if (rule.pregnancyRequired) {
      const isPregnant = patientState.pregnant || allText.includes('pregnant') ||
                        allText.includes('embarazada') || allText.includes('enceinte');
      if (!isPregnant) continue;
    }

    redFlags.push({
      flag_id: crypto.randomUUID(),
      rule_id: rule.ruleId,
      flag_type: rule.category,
      description: rule.name.en,
      severity: rule.severity,
      escalation_level: rule.escalationLevel,
      action_taken: rule.action.en,
      detected_at: new Date().toISOString(),
    });

    if (rule.escalationLevel === 'emergency') {
      requiresEscalation = true;
      escalationReason = rule.action.en;
    }

    if (!highestSeverity || ['low', 'moderate', 'high', 'critical'].indexOf(rule.severity) >
        ['low', 'moderate', 'high', 'critical'].indexOf(highestSeverity)) {
      highestSeverity = rule.severity;
    }
  }

  return { triggered: redFlags.length > 0, redFlags, requiresEscalation, escalationReason, highestSeverity };
}

function getEmergencyResponse(language: Language, escalationReason: string): string {
  const responses: Record<Language, string> = {
    en: escalationReason,
    es: escalationReason, // Already translated in rule
    fr: escalationReason,
  };
  return responses[language] || responses.en;
}

// ============================================
// SYMPTOM EXTRACTION & OLDCARTS UPDATE
// ============================================

async function extractSymptomsAndUpdateOLDCARTS(
  anthropic: Anthropic,
  message: string,
  currentOLDCARTS: OLDCARTSData,
  language: Language
): Promise<{ oldcarts: OLDCARTSData; symptoms: string[] }> {
  const prompt = `Extract symptom information from this patient message and update OLDCARTS data.

Current OLDCARTS state:
${JSON.stringify(currentOLDCARTS, null, 2)}

Patient message: "${message}"

Extract any new information for:
- onset: When did symptoms start? (e.g., "2 days ago", "this morning")
- location: Where is the symptom? (e.g., "chest", "left arm", "head")
- duration: How long does it last? (e.g., "constant", "30 minutes")
- character: What does it feel like? (e.g., "sharp", "dull", "throbbing")
- aggravating: What makes it worse? (e.g., "movement", "eating")
- relieving: What makes it better? (e.g., "rest", "medication")
- timing: When does it occur? (e.g., "at night", "after meals")
- severity: Pain level 0-10? (extract number if mentioned)
- associatedSymptoms: Other symptoms mentioned

Respond with JSON only:
{
  "updates": {
    "onset": { "value": "extracted value or null", "complete": true/false },
    "location": { "value": "extracted value or null", "complete": true/false },
    "duration": { "value": "extracted value or null", "complete": true/false },
    "character": { "value": "extracted value or null", "complete": true/false },
    "aggravating": { "value": "extracted value or null", "complete": true/false },
    "relieving": { "value": "extracted value or null", "complete": true/false },
    "timing": { "value": "extracted value or null", "complete": true/false },
    "severity": { "value": number or null, "complete": true/false }
  },
  "newSymptoms": ["list of symptoms extracted"],
  "chiefComplaintUpdate": "updated chief complaint if clearer now, or null"
}`;

  try {
    const resp = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const content = resp.content[0];
    if (content.type !== "text") {
      return { oldcarts: currentOLDCARTS, symptoms: [] };
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { oldcarts: currentOLDCARTS, symptoms: [] };
    }

    const extraction = JSON.parse(jsonMatch[0]);
    const now = new Date().toISOString();

    // Merge updates into current OLDCARTS
    const updated = { ...currentOLDCARTS };

    for (const [field, update] of Object.entries(extraction.updates || {})) {
      const fieldKey = field as keyof typeof updated;
      if (fieldKey in updated && update && typeof update === 'object') {
        const updateObj = update as { value: unknown; complete: boolean };
        if (updateObj.value !== null && updateObj.value !== undefined) {
          if (fieldKey === 'severity') {
            updated.severity = {
              value: typeof updateObj.value === 'number' ? updateObj.value : null,
              complete: updateObj.complete,
              collectedAt: now,
            };
          } else if (fieldKey !== 'chiefComplaint' && fieldKey !== 'completenessPercentage' && fieldKey !== 'associatedSymptoms') {
            (updated[fieldKey] as OLDCARTSField) = {
              value: String(updateObj.value),
              complete: updateObj.complete,
              collectedAt: now,
            };
          }
        }
      }
    }

    // Add new associated symptoms
    if (extraction.newSymptoms?.length > 0) {
      const existingSymptoms = new Set(updated.associatedSymptoms.map((s: string) => s.toLowerCase()));
      for (const symptom of extraction.newSymptoms) {
        if (!existingSymptoms.has(symptom.toLowerCase())) {
          updated.associatedSymptoms.push(symptom);
        }
      }
    }

    // Update chief complaint if clearer
    if (extraction.chiefComplaintUpdate && !updated.chiefComplaint) {
      updated.chiefComplaint = extraction.chiefComplaintUpdate;
    }

    // Recalculate completeness
    updated.completenessPercentage = calculateOLDCARTSProgress(updated);

    return { oldcarts: updated, symptoms: extraction.newSymptoms || [] };
  } catch (error) {
    console.error("[HELIOS] Extraction error:", error);
    return { oldcarts: currentOLDCARTS, symptoms: [] };
  }
}

// ============================================
// ASSESSMENT TRIGGERS
// ============================================

interface AssessmentTriggerResult {
  shouldAssess: boolean;
  reason?: string;
}

function checkAssessmentTriggers(
  oldcarts: OLDCARTSData,
  messageCount: number,
  hasHighRiskSymptoms: boolean,
  userRequestedAssessment: boolean
): AssessmentTriggerResult {
  // User explicitly requested assessment
  if (userRequestedAssessment) {
    return { shouldAssess: true, reason: 'user_requested' };
  }

  // OLDCARTS completeness >= 50% (lowered from 70% for testing)
  if (oldcarts.completenessPercentage >= 50) {
    console.log("[HELIOS] OLDCARTS trigger: completeness =", oldcarts.completenessPercentage);
    return { shouldAssess: true, reason: 'oldcarts_complete' };
  }

  // Essential fields complete (onset, location, severity)
  const essentialsComplete = oldcarts.onset.complete &&
                            oldcarts.location.complete &&
                            oldcarts.severity.complete;
  if (essentialsComplete && messageCount >= 4) {
    return { shouldAssess: true, reason: 'essentials_complete' };
  }

  // High-risk symptoms detected
  if (hasHighRiskSymptoms && messageCount >= 3) {
    return { shouldAssess: true, reason: 'high_risk_symptoms' };
  }

  // Extended conversation (8+ exchanges)
  if (messageCount >= 8) {
    return { shouldAssess: true, reason: 'conversation_length' };
  }

  return { shouldAssess: false };
}

function detectUserAssessmentRequest(message: string): boolean {
  const assessmentPhrases = [
    'what do you think', 'your assessment', 'what could it be',
    'diagnose', 'diagnosis', 'what\'s wrong', 'should i be worried',
    'is it serious', 'what should i do', 'need to see a doctor',
    'please assess', 'assess my', 'my assessment', 'give me an assessment',
    'qué crees', 'tu evaluación', 'qué puede ser',
    'qu\'en pensez', 'votre évaluation', 'qu\'est-ce que c\'est',
  ];
  const lowerMessage = message.toLowerCase();
  const result = assessmentPhrases.some(phrase => lowerMessage.includes(phrase));
  console.log("[HELIOS] User assessment request detection:", result, "message sample:", lowerMessage.substring(0, 100));
  return result;
}

function detectHighRiskSymptoms(symptoms: string[]): boolean {
  const highRiskKeywords = [
    'severe', 'worst', 'sudden', 'acute', 'can\'t', 'blood',
    'severo', 'peor', 'repentino', 'sangre',
    'sévère', 'pire', 'soudain', 'sang',
  ];
  return symptoms.some(s =>
    highRiskKeywords.some(k => s.toLowerCase().includes(k))
  );
}

// ============================================
// GRAND ROUNDS INTEGRATION
// ============================================

async function runGrandRoundsAssessment(
  sessionId: string,
  oldcarts: OLDCARTSData,
  patientDemographics: { age?: number; gender?: string },
  symptoms: string[]
): Promise<{ consensus: ConsensusResult; orchestration: OrchestrationResponse } | null> {
  if (!GRAND_ROUNDS_API_URL) {
    console.log("[HELIOS] Grand Rounds API not configured, skipping");
    return null;
  }

  try {
    // Call the orchestrator edge function (internal call with service role)
    console.log("[HELIOS] Calling Grand Rounds orchestrator at:", GRAND_ROUNDS_API_URL);
    const response = await fetch(GRAND_ROUNDS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'X-API-Key': GRAND_ROUNDS_API_KEY,
      },
      body: JSON.stringify({
        session_id: sessionId,
        chief_complaint: oldcarts.chiefComplaint,
        oldcarts_data: {
          onset: oldcarts.onset.value,
          location: oldcarts.location.value,
          duration: oldcarts.duration.value,
          character: oldcarts.character.value,
          aggravating: oldcarts.aggravating.value,
          relieving: oldcarts.relieving.value,
          timing: oldcarts.timing.value,
          severity: oldcarts.severity.value,
        },
        symptoms: symptoms.length > 0 ? symptoms : oldcarts.associatedSymptoms,
        patient_demographics: {
          age: patientDemographics.age,
          sex: patientDemographics.gender,
        },
        config: {
          max_rounds: 3,
          consensus_threshold: 0.7,
          min_specialists: 3,
          max_specialists: 5,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[HELIOS] Orchestrator API error:", response.status, errorText);
      // Return error details for debugging
      return { error: `HTTP ${response.status}: ${errorText.substring(0, 200)}` } as any;
    }

    const orchestration: OrchestrationResponse = await response.json();

    // Transform OrchestrationResponse to ConsensusResult for backward compatibility
    const consensus: ConsensusResult = {
      kendallW: orchestration.consensus.kendall_w,
      consensusReached: orchestration.consensus.consensus_reached,
      roundsRequired: orchestration.consensus.rounds_required,
      participatingAgents: orchestration.consensus.participating_agents,
      primaryDiagnosis: {
        diagnosis: orchestration.consensus.primary_diagnosis.diagnosis,
        icd10: {
          code: orchestration.consensus.primary_diagnosis.icd10_code,
          name: orchestration.consensus.primary_diagnosis.icd10_name,
        },
        confidence: orchestration.consensus.primary_diagnosis.confidence,
        reasoning: orchestration.consensus.primary_diagnosis.reasoning,
      },
      differentialDiagnosis: orchestration.consensus.differential_diagnoses.map(d => ({
        rank: d.rank,
        diagnosis: d.diagnosis,
        icd10: { code: d.icd10_code, name: d.icd10_name },
        confidence: d.confidence,
        reasoning: d.reasoning,
      })),
      planOfAction: {
        labTests: orchestration.plan.lab_tests,
        imaging: orchestration.plan.imaging,
        referrals: orchestration.plan.referrals,
        medications: orchestration.plan.medications,
        patientEducation: orchestration.plan.patient_education,
        followUp: orchestration.plan.follow_up,
        redFlagWarnings: orchestration.plan.red_flag_warnings,
      },
      finalEsiLevel: orchestration.triage.esi_level,
      humanReviewRequired: orchestration.triage.human_review_required,
      humanReviewReason: orchestration.triage.human_review_reason,
      disposition: orchestration.triage.disposition,
    };

    return { consensus, orchestration };
  } catch (error) {
    console.error("[HELIOS] Orchestrator API call failed:", error);
    return null;
  }
}

function buildCaseSummary(
  oldcarts: OLDCARTSData,
  demographics: { age?: number; gender?: string }
): string {
  const parts: string[] = [];

  if (demographics.age || demographics.gender) {
    parts.push(`Patient: ${demographics.age ? `${demographics.age} year old` : ''} ${demographics.gender || ''}`.trim());
  }

  parts.push(`Chief Complaint: ${oldcarts.chiefComplaint}`);

  if (oldcarts.onset.value) parts.push(`Onset: ${oldcarts.onset.value}`);
  if (oldcarts.location.value) parts.push(`Location: ${oldcarts.location.value}`);
  if (oldcarts.duration.value) parts.push(`Duration: ${oldcarts.duration.value}`);
  if (oldcarts.character.value) parts.push(`Character: ${oldcarts.character.value}`);
  if (oldcarts.severity.value !== null) parts.push(`Severity: ${oldcarts.severity.value}/10`);
  if (oldcarts.aggravating.value) parts.push(`Aggravating factors: ${oldcarts.aggravating.value}`);
  if (oldcarts.relieving.value) parts.push(`Relieving factors: ${oldcarts.relieving.value}`);
  if (oldcarts.timing.value) parts.push(`Timing: ${oldcarts.timing.value}`);

  if (oldcarts.associatedSymptoms.length > 0) {
    parts.push(`Associated symptoms: ${oldcarts.associatedSymptoms.join(', ')}`);
  }

  return parts.join('\n');
}

// ============================================
// FOLLOW-UP QUESTION GENERATION
// ============================================

async function generateFollowUpQuestion(
  anthropic: Anthropic,
  oldcarts: OLDCARTSData,
  messages: Array<{ role: string; content: string }>,
  language: Language,
  specialty: string
): Promise<string> {
  // Determine which OLDCARTS fields need more info
  const missingFields: string[] = [];
  if (!oldcarts.onset.complete) missingFields.push('onset (when did it start?)');
  if (!oldcarts.location.complete) missingFields.push('location (where exactly?)');
  if (!oldcarts.severity.complete) missingFields.push('severity (pain level 0-10)');
  if (!oldcarts.character.complete) missingFields.push('character (what does it feel like?)');
  if (!oldcarts.duration.complete) missingFields.push('duration (how long does it last?)');
  if (!oldcarts.aggravating.complete) missingFields.push('aggravating factors (what makes it worse?)');
  if (!oldcarts.relieving.complete) missingFields.push('relieving factors (what makes it better?)');

  const languageInstructions: Record<Language, string> = {
    en: "Respond in English.",
    es: "Responde en español.",
    fr: "Répondez en français.",
  };

  const systemPrompt = `You are HELIOS, an AI health assistant conducting a symptom intake. Be warm, empathetic, and professional.

Current OLDCARTS data collected:
- Chief Complaint: ${oldcarts.chiefComplaint}
- Onset: ${oldcarts.onset.value || 'Not collected'}
- Location: ${oldcarts.location.value || 'Not collected'}
- Duration: ${oldcarts.duration.value || 'Not collected'}
- Character: ${oldcarts.character.value || 'Not collected'}
- Severity: ${oldcarts.severity.value !== null ? `${oldcarts.severity.value}/10` : 'Not collected'}
- Aggravating: ${oldcarts.aggravating.value || 'Not collected'}
- Relieving: ${oldcarts.relieving.value || 'Not collected'}
- Associated symptoms: ${oldcarts.associatedSymptoms.join(', ') || 'None noted'}

Completeness: ${oldcarts.completenessPercentage.toFixed(0)}%

Missing information needed: ${missingFields.join(', ') || 'All essential info collected'}

GUIDELINES:
- Ask about ONE or TWO missing pieces of information at a time
- Prioritize essential fields: onset, location, severity
- Be conversational, not interrogative
- Acknowledge what the patient has shared
- ${languageInstructions[language]}

Specialty focus: ${specialty}`;

  const apiMessages = messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .slice(-10)
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  try {
    const resp = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      system: systemPrompt,
      messages: apiMessages,
    });

    return resp.content[0].type === "text" ? resp.content[0].text : "Could you tell me more about your symptoms?";
  } catch (error) {
    console.error("[HELIOS] Follow-up generation error:", error);
    return language === 'es' ? "¿Puedes contarme más sobre tus síntomas?" :
           language === 'fr' ? "Pouvez-vous m'en dire plus sur vos symptômes?" :
           "Could you tell me more about your symptoms?";
  }
}

// ============================================
// ASSESSMENT MESSAGE FORMATTING
// ============================================

function formatAssessmentMessage(
  consensus: ConsensusResult,
  language: Language,
  orchestration?: OrchestrationResponse
): string {
  const templates: Record<Language, { header: string; diagnosis: string; differentials: string; plan: string; followUp: string; warning: string; confidence: string; consensus: string }> = {
    en: {
      header: "Based on the information you've provided, here's my assessment:",
      diagnosis: "Most likely explanation",
      differentials: "Other possibilities to consider",
      plan: "Recommended next steps",
      followUp: "When to seek care",
      warning: "Warning signs to watch for",
      confidence: "Confidence",
      consensus: "Multi-specialist consensus",
    },
    es: {
      header: "Basándome en la información que proporcionaste, aquí está mi evaluación:",
      diagnosis: "Explicación más probable",
      differentials: "Otras posibilidades a considerar",
      plan: "Próximos pasos recomendados",
      followUp: "Cuándo buscar atención",
      warning: "Señales de advertencia",
      confidence: "Confianza",
      consensus: "Consenso multi-especialista",
    },
    fr: {
      header: "Sur la base des informations fournies, voici mon évaluation:",
      diagnosis: "Explication la plus probable",
      differentials: "Autres possibilités à considérer",
      plan: "Prochaines étapes recommandées",
      followUp: "Quand consulter",
      warning: "Signes d'alerte",
      confidence: "Confiance",
      consensus: "Consensus multi-spécialiste",
    },
  };

  const t = templates[language] || templates.en;
  const lines: string[] = [t.header, ""];

  // Show consensus info if available
  if (orchestration && orchestration.consensus.consensus_reached) {
    const kendallPercent = Math.round(orchestration.consensus.kendall_w * 100);
    lines.push(`_${t.consensus}: ${kendallPercent}% agreement (${orchestration.consensus.participating_agents.length} specialists)_`);
    lines.push("");
  }

  // Primary diagnosis with confidence
  if (consensus.primaryDiagnosis) {
    const confidencePercent = Math.round(consensus.primaryDiagnosis.confidence * 100);
    lines.push(`**${t.diagnosis}:** ${consensus.primaryDiagnosis.diagnosis}`);
    lines.push(`_${t.confidence}: ${confidencePercent}%_`);
    lines.push("");
    lines.push(consensus.primaryDiagnosis.reasoning);
    lines.push("");
  }

  // Differential diagnoses
  if (consensus.differentialDiagnosis?.length > 0) {
    lines.push(`**${t.differentials}:**`);
    for (const diff of consensus.differentialDiagnosis.slice(0, 3)) {
      const confPercent = Math.round(diff.confidence * 100);
      lines.push(`- ${diff.diagnosis} (${confPercent}%)`);
    }
    lines.push("");
  }

  // Plan of action
  if (consensus.planOfAction) {
    lines.push(`**${t.plan}:**`);
    if (consensus.planOfAction.labTests?.length > 0) {
      lines.push(`- Tests: ${consensus.planOfAction.labTests.join(', ')}`);
    }
    if (consensus.planOfAction.imaging?.length > 0) {
      lines.push(`- Imaging: ${consensus.planOfAction.imaging.join(', ')}`);
    }
    if (consensus.planOfAction.referrals?.length > 0) {
      lines.push(`- Referrals: ${consensus.planOfAction.referrals.join(', ')}`);
    }
    if (consensus.planOfAction.medications?.length > 0) {
      lines.push(`- Medications: ${consensus.planOfAction.medications.join(', ')}`);
    }
    lines.push("");
  }

  // Follow-up
  if (consensus.planOfAction?.followUp) {
    lines.push(`**${t.followUp}:** ${consensus.planOfAction.followUp}`);
    lines.push("");
  }

  // Red flag warnings
  if (consensus.planOfAction?.redFlagWarnings?.length > 0) {
    lines.push(`**${t.warning}:**`);
    for (const warning of consensus.planOfAction.redFlagWarnings) {
      lines.push(`- ⚠️ ${warning}`);
    }
    lines.push("");
  }

  // Safety critical finding
  if (orchestration?.safety.critical_finding && orchestration.safety.immediate_action) {
    lines.push(`**🚨 IMPORTANT:** ${orchestration.safety.immediate_action}`);
  }

  return lines.join('\n');
}

// ============================================
// SOAP NOTE GENERATION (FALLBACK)
// ============================================

async function generateSOAPNote(
  anthropic: Anthropic,
  messages: Array<{ role: string; content: string }>,
  oldcarts: OLDCARTSData,
  patientInfo: Record<string, unknown>,
  language: Language
): Promise<string> {
  const conversationText = messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => `${m.role === 'user' ? 'Patient' : 'HELIOS'}: ${m.content}`)
    .join('\n');

  const prompt = `Generate a SOAP note from this health consultation.

OLDCARTS Data:
${JSON.stringify(oldcarts, null, 2)}

Patient Info: ${JSON.stringify(patientInfo)}

Conversation:
${conversationText}

Generate a SOAP note with:
- Subjective: Chief complaint, HPI using OLDCARTS
- Objective: Self-reported findings
- Assessment: Summary and ESI level recommendation
- Plan: Recommendations

Keep it concise. ${language === 'es' ? 'Write in Spanish.' : language === 'fr' ? 'Write in French.' : ''}`;

  try {
    const resp = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    return resp.content[0].type === "text" ? resp.content[0].text : "";
  } catch {
    return "SOAP note generation failed";
  }
}

// ============================================
// CONTEXT WINDOW MANAGEMENT
// ============================================

const MAX_CONTEXT_MESSAGES = 20;

function manageContextWindow(messages: Array<{ role: string; content: string }>): Array<{ role: string; content: string }> {
  if (messages.length <= MAX_CONTEXT_MESSAGES) return messages;

  const systemMessages = messages.filter(m => m.role === 'system');
  const nonSystemMessages = messages.filter(m => m.role !== 'system');

  const keepFirst = Math.min(2, nonSystemMessages.length);
  const firstMessages = nonSystemMessages.slice(0, keepFirst);
  const keepLast = MAX_CONTEXT_MESSAGES - keepFirst - systemMessages.length - 1;
  const lastMessages = nonSystemMessages.slice(-keepLast);

  return [...systemMessages, ...firstMessages, ...lastMessages];
}

// ============================================
// TRIAGE LEVEL CALCULATION
// ============================================

function calculateTriageLevel(
  symptoms: string[],
  severity: number | null,
  age: number | undefined,
  redFlags: RedFlag[]
): TriageLevel {
  // Level 1: Life-threatening
  if (redFlags.some(f => f.escalation_level === 'emergency')) return 1;

  // Level 2: High risk / severe
  const highRiskKeywords = ['severe', 'worst', 'sudden', 'acute'];
  const hasHighRisk = symptoms.some(s => highRiskKeywords.some(k => s.toLowerCase().includes(k)));
  if (hasHighRisk || (severity !== null && severity >= 8)) return 2;

  // Level 3: Moderate / needs resources
  if ((severity !== null && severity >= 5) || (age && (age < 2 || age > 70))) return 3;

  // Level 4: Less urgent
  if (severity !== null && severity >= 3) return 4;

  // Level 5: Non-urgent
  return 5;
}

// ============================================
// MAIN REQUEST HANDLER
// ============================================

interface HandleMessageResult {
  message: string;
  assessmentReady: boolean;
  triggerOrchestrator?: boolean;
  orchestratorPayload?: {
    session_id: string;
    chief_complaint: string;
    oldcarts_data: Record<string, unknown>;
    symptoms: string[];
    patient_demographics: Record<string, unknown>;
  };
  consensus?: ConsensusResult;
  orchestration?: OrchestrationResponse;
  soapNote?: string;
  recommendDoctor: boolean;
  oldcartsProgress: number;
  triageLevel?: TriageLevel;
  phase: Phase;
  redFlags: RedFlag[];
  // Prescription flow fields
  buttons?: Array<{ label: string; value: string }>;
  inputType?: string;
  inputPlaceholder?: string;
}

async function handleMessage(
  supabase: SupabaseClient,
  anthropic: Anthropic,
  sessionId: string,
  userMessage: string,
  language: Language,
  specialty: string
): Promise<HandleMessageResult> {
  // 1. Load session state
  const { data: session, error: sessErr } = await supabase
    .from("helios_sessions")
    .select("*")
    .eq("session_id", sessionId)
    .single();

  if (sessErr || !session) {
    throw new Error("Session not found");
  }

  const history = session.messages || [];
  const patientInfo = session.patient_info || {};
  let currentPhase = (session.current_phase || "intake") as Phase;
  let oldcarts: OLDCARTSData = session.oldcarts_data || createEmptyOLDCARTS(session.chief_complaint || "");
  const existingRedFlags = session.red_flags || [];

  // Build patient state
  const patientState: PatientState = {
    age: patientInfo.age,
    ageUnit: patientInfo.age_unit || 'years',
    sex: patientInfo.sex,
    pregnant: patientInfo.pregnant,
    symptoms: oldcarts.associatedSymptoms,
    riskFactors: patientInfo.risk_factors || [],
    medications: patientInfo.medications || [],
    messages: history.map((m: { content: string }) => m.content),
  };

  // 2. Emergency check (deterministic, fast)
  const safetyResult = isEmergency(userMessage, patientState);
  if (safetyResult.requiresEscalation) {
    await supabase.from("helios_sessions").update({
      current_phase: "escalated",
      red_flags: [...existingRedFlags, ...safetyResult.redFlags],
      updated_at: new Date().toISOString(),
    }).eq("session_id", sessionId);

    return {
      message: getEmergencyResponse(language, safetyResult.escalationReason || ""),
      assessmentReady: false,
      recommendDoctor: false,
      oldcartsProgress: oldcarts.completenessPercentage,
      phase: "escalated",
      redFlags: safetyResult.redFlags,
    };
  }

  // 2.5. Check for prescription flow
  let prescriptionFlow: PrescriptionFlowState | null = session.prescription_flow || null;
  const prescriptionIntent = detectPrescriptionIntent(userMessage);
  
  // Start a new prescription flow if intent detected and not already in one
  if (prescriptionIntent && !prescriptionFlow) {
    prescriptionFlow = { type: prescriptionIntent, currentStep: 0, data: {} };
    const stepResult = getNextPrescriptionStep(prescriptionFlow, language);
    
    const now = new Date().toISOString();
    await supabase.from("helios_sessions").update({
      prescription_flow: prescriptionFlow,
      current_phase: prescriptionIntent === 'refill' ? 'prescription_refill' : 'prescription_new',
      messages: [...history, 
        { role: "user", content: userMessage, message_id: crypto.randomUUID(), timestamp: now },
        { role: "assistant", content: stepResult.message, message_id: crypto.randomUUID(), timestamp: now }
      ],
      updated_at: now,
    }).eq("session_id", sessionId);
    
    return {
      message: stepResult.message,
      buttons: stepResult.buttons,
      inputType: stepResult.inputType,
      inputPlaceholder: stepResult.placeholder,
      assessmentReady: false,
      recommendDoctor: false,
      oldcartsProgress: 0,
      phase: prescriptionIntent === 'refill' ? 'prescription_refill' : 'prescription_new',
      redFlags: [],
    };
  }
  
  // Continue existing prescription flow
  if (prescriptionFlow && (currentPhase === 'prescription_refill' || currentPhase === 'prescription_new')) {
    prescriptionFlow = processRefillFlowStep(prescriptionFlow, userMessage);
    const stepResult = getNextPrescriptionStep(prescriptionFlow, language);
    
    const now = new Date().toISOString();
    await supabase.from("helios_sessions").update({
      prescription_flow: prescriptionFlow,
      messages: [...history,
        { role: "user", content: userMessage, message_id: crypto.randomUUID(), timestamp: now },
        { role: "assistant", content: stepResult.message, message_id: crypto.randomUUID(), timestamp: now }
      ],
      updated_at: now,
    }).eq("session_id", sessionId);
    
    return {
      message: stepResult.message,
      buttons: stepResult.buttons,
      inputType: stepResult.inputType,
      inputPlaceholder: stepResult.placeholder,
      assessmentReady: stepResult.isComplete,
      recommendDoctor: stepResult.isComplete,
      oldcartsProgress: 0,
      phase: currentPhase,
      redFlags: [],
    };
  }

  // 3. Extract symptoms and update OLDCARTS
  const extraction = await extractSymptomsAndUpdateOLDCARTS(
    anthropic,
    userMessage,
    oldcarts,
    language
  );
  oldcarts = extraction.oldcarts;

  // Set chief complaint from first user message if not set
  if (!oldcarts.chiefComplaint && history.length === 0) {
    oldcarts.chiefComplaint = userMessage.substring(0, 200);
  }

  // 4. Check assessment triggers
  const userRequestedAssessment = detectUserAssessmentRequest(userMessage);
  const hasHighRisk = detectHighRiskSymptoms(extraction.symptoms);
  const messageCount = history.filter((m: { role: string }) => m.role === 'user').length + 1;

  const assessmentTrigger = checkAssessmentTriggers(
    oldcarts,
    messageCount,
    hasHighRisk,
    userRequestedAssessment
  );

  // Build new messages
  const now = new Date().toISOString();
  let responseMessage: string;
  let consensus: ConsensusResult | null = null;
  let orchestration: OrchestrationResponse | null = null;
  let soapNote: string | undefined;
  let assessmentReady = false;
  let newPhase = currentPhase;

  console.log("[HELIOS] Assessment check:", {
    shouldAssess: assessmentTrigger.shouldAssess,
    reason: assessmentTrigger.reason,
    hasConsensusResult: !!session.consensus_result,
    oldcartsProgress: oldcarts.completenessPercentage,
    messageCount,
    userRequestedAssessment,
  });

  // Check if assessment should be triggered (client will call orchestrator directly)
  const shouldTriggerOrchestrator = assessmentTrigger.shouldAssess && !session.consensus_result;

  if (shouldTriggerOrchestrator) {
    // Signal to client to call orchestrator, but still provide a response
    responseMessage = await generateFollowUpQuestion(
      anthropic,
      oldcarts,
      [...history, { role: 'user', content: userMessage }],
      language,
      specialty
    );
    newPhase = 'triage';
    assessmentReady = true; // Signal that orchestrator should be called
  } else {
    // 5b. Continue intake conversation
    responseMessage = await generateFollowUpQuestion(
      anthropic,
      oldcarts,
      [...history, { role: 'user', content: userMessage }],
      language,
      specialty
    );

    // Determine phase transition
    if (currentPhase === 'intake' && oldcarts.chiefComplaint) {
      newPhase = 'chief_complaint';
    } else if (currentPhase === 'chief_complaint' && messageCount >= 2) {
      newPhase = 'history_taking';
    } else if (currentPhase === 'history_taking' && oldcarts.completenessPercentage >= 70) {
      newPhase = 'triage';
    }
  }

  // Calculate triage level
  const triageLevel = calculateTriageLevel(
    oldcarts.associatedSymptoms,
    oldcarts.severity.value,
    patientInfo.age,
    [...existingRedFlags, ...safetyResult.redFlags]
  );

  // Update session
  const newMessages = [
    ...history,
    { role: "user", content: userMessage, message_id: crypto.randomUUID(), timestamp: now },
    { role: "assistant", content: responseMessage, message_id: crypto.randomUUID(), timestamp: now },
  ];

  const updateData: Record<string, unknown> = {
    messages: newMessages,
    current_phase: newPhase,
    oldcarts_data: oldcarts,
    triage_level: triageLevel,
    updated_at: now,
    red_flags: [...existingRedFlags, ...safetyResult.redFlags],
  };

  if (!session.chief_complaint && oldcarts.chiefComplaint) {
    updateData.chief_complaint = oldcarts.chiefComplaint;
  }

  if (consensus) {
    updateData.consensus_result = consensus;
  }

  if (soapNote) {
    updateData.soap_note = soapNote;
  }

  // Store full orchestration result with dissenting opinions and safety data
  // Use type assertion since TypeScript narrows to never when variable is unused in current path
  const orchestrationData = orchestration as OrchestrationResponse | null;
  if (orchestrationData) {
    updateData.orchestration_result = {
      consensus: orchestrationData.consensus,
      triage: orchestrationData.triage,
      plan: orchestrationData.plan,
      safety: orchestrationData.safety,
      processing_time_ms: orchestrationData.processing_time_ms,
    };

    // Store dissenting opinions separately for easy access
    if (orchestrationData.consensus.dissenting_opinions?.length) {
      updateData.dissenting_opinions = orchestrationData.consensus.dissenting_opinions;
    }

    // Update triage level from orchestrator if available
    if (orchestrationData.triage.esi_level) {
      updateData.triage_level = orchestrationData.triage.esi_level;
    }

    // Update disposition from orchestrator
    if (orchestrationData.triage.disposition) {
      updateData.disposition = orchestrationData.triage.disposition;
    }
  }

  await supabase.from("helios_sessions").update(updateData).eq("session_id", sessionId);

  // Build orchestrator payload for client-side call
  const orchestratorPayload = shouldTriggerOrchestrator ? {
    session_id: sessionId,
    chief_complaint: oldcarts.chiefComplaint,
    oldcarts_data: {
      onset: oldcarts.onset.value,
      location: oldcarts.location.value,
      duration: oldcarts.duration.value,
      character: oldcarts.character.value,
      aggravating: oldcarts.aggravating.value,
      relieving: oldcarts.relieving.value,
      timing: oldcarts.timing.value,
      severity: oldcarts.severity.value,
    },
    symptoms: oldcarts.associatedSymptoms,
    patient_demographics: {
      age: patientInfo.age,
      sex: patientInfo.sex,
      medical_history: patientInfo.medicalHistory,
      medications: patientInfo.medications,
      allergies: patientInfo.allergies,
    },
  } : undefined;

  return {
    message: responseMessage,
    assessmentReady,
    triggerOrchestrator: shouldTriggerOrchestrator,
    orchestratorPayload,
    consensus: consensus || undefined,
    orchestration: orchestrationData || undefined,
    soapNote,
    recommendDoctor: triageLevel <= 3,
    oldcartsProgress: oldcarts.completenessPercentage,
    triageLevel: orchestrationData?.triage.esi_level || triageLevel,
    phase: newPhase,
    redFlags: safetyResult.redFlags,
  };
}

// ============================================
// MAIN SERVER
// ============================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const anthropic = new Anthropic({ apiKey: anthropicKey });
    const devSupabase = getDevSupabase();

    const body = await req.json();
    const action = body.action;
    const session_id = body.session_id;
    const message = body.message;
    const patient_info = body.patient_info || {};
    const specialty = body.specialty || "primary-care";
    const language = (body.language || "en") as Language;
    const user_id = body.user_id;

    // ========================================
    // ACTION: CREATE SESSION
    // ========================================
    if (action === "create") {
      const sessionId = crypto.randomUUID();
      const patientInfoWithUser = { ...patient_info };

      if (user_id && typeof user_id === 'string' && user_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        patientInfoWithUser.external_user_id = user_id;
      }

      const sessionData: Record<string, unknown> = {
        session_id: sessionId,
        current_phase: "intake",
        specialty: specialty,
        language: language,
        messages: [],
        patient_info: patientInfoWithUser,
        oldcarts_data: createEmptyOLDCARTS(""),
        created_at: new Date().toISOString(),
      };

      const { error: insertErr } = await supabase.from("helios_sessions").insert(sessionData);
      if (insertErr) {
        console.error("Failed to insert session:", insertErr);
        return new Response(JSON.stringify({ success: false, error: "Failed to create session: " + insertErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await syncToDevProject(devSupabase, "helios_sessions", "insert", sessionData);

      const greetings: Record<string, Record<Language, string>> = {
        "primary-care": { en: "Hello! I'm your HELIOS health assistant. What brings you in today?", es: "¡Hola! Soy tu asistente de salud HELIOS. ¿Qué te trae hoy?", fr: "Bonjour! Je suis votre assistant santé HELIOS. Qu'est-ce qui vous amène aujourd'hui?" },
        "cardiology": { en: "Hello! I'm HELIOS, here to help with heart-related concerns. What symptoms are you experiencing?", es: "¡Hola! Soy HELIOS, aquí para ayudar con preocupaciones cardíacas. ¿Qué síntomas experimentas?", fr: "Bonjour! Je suis HELIOS, ici pour les problèmes cardiaques. Quels symptômes ressentez-vous?" },
        "mental-health": { en: "Hello, I'm HELIOS. I'm here to listen and help. How are you feeling today?", es: "Hola, soy HELIOS. Estoy aquí para escuchar y ayudar. ¿Cómo te sientes hoy?", fr: "Bonjour, je suis HELIOS. Je suis là pour écouter et aider. Comment vous sentez-vous?" },
        "dermatology": { en: "Hello! I'm HELIOS, ready to help with skin-related concerns. Can you describe what you're seeing?", es: "¡Hola! Soy HELIOS, listo para ayudar con problemas de piel. ¿Puedes describir lo que ves?", fr: "Bonjour! Je suis HELIOS, prêt pour les problèmes de peau. Pouvez-vous décrire ce que vous voyez?" },
        "pediatrics": { en: "Hello! I'm HELIOS, here to help with your child's health. What concerns do you have?", es: "¡Hola! Soy HELIOS, aquí para ayudar con la salud de tu hijo. ¿Qué preocupaciones tienes?", fr: "Bonjour! Je suis HELIOS, pour la santé de votre enfant. Quelles sont vos préoccupations?" },
        "womens-health": { en: "Hello! I'm HELIOS, ready to help with your health questions. What would you like to discuss?", es: "¡Hola! Soy HELIOS, lista para ayudar con tus preguntas de salud. ¿Qué te gustaría discutir?", fr: "Bonjour! Je suis HELIOS, prête pour vos questions de santé. Que souhaitez-vous aborder?" },
        "orthopedics": { en: "Hello! I'm HELIOS, here to help with bone and joint concerns. Where are you experiencing pain?", es: "¡Hola! Soy HELIOS, aquí para ayudar con huesos y articulaciones. ¿Dónde sientes dolor?", fr: "Bonjour! Je suis HELIOS, pour les problèmes osseux et articulaires. Où ressentez-vous la douleur?" },
      };

      const greeting = greetings[specialty]?.[language] || greetings["primary-care"]?.en || "Hello! How can I help you today?";

      return new Response(JSON.stringify({
        success: true,
        session_id: sessionId,
        phase: "intake",
        specialty: specialty,
        message: greeting,
        oldcartsProgress: 0,
        ui_triggers: { showAssessment: false, showBooking: false, showEmergency: false },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========================================
    // ACTION: SEND MESSAGE (REFACTORED)
    // ========================================
    if (action === "message") {
      const result = await handleMessage(
        supabase,
        anthropic,
        session_id,
        message,
        language,
        specialty
      );

      const uiTriggers = {
        showAssessment: result.assessmentReady,
        showBooking: result.recommendDoctor,
        showEmergency: result.phase === 'escalated' || (result.triageLevel && result.triageLevel <= 2),
        showSummary: result.phase === 'completed',
      };

      return new Response(JSON.stringify({
        success: true,
        session_id: session_id,
        phase: result.phase,
        message: result.message,
        triage_level: result.triageLevel,
        red_flags: result.redFlags,
        oldcarts_progress: result.oldcartsProgress,
        assessment_ready: result.assessmentReady,
        trigger_orchestrator: result.triggerOrchestrator,
        orchestrator_payload: result.orchestratorPayload,
        consensus: result.consensus,
        orchestration: result.orchestration,
        soap_note: result.soapNote,
        dissenting_opinions: result.orchestration?.consensus.dissenting_opinions,
        recommend_doctor: result.recommendDoctor,
        ui_triggers: uiTriggers,
        // Prescription flow fields
        buttons: result.buttons,
        input_type: result.inputType,
        input_placeholder: result.inputPlaceholder,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========================================
    // ACTION: COMPLETE SESSION
    // ========================================
    if (action === "complete_session") {
      if (!session_id) {
        return new Response(JSON.stringify({ success: false, error: "session_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: session } = await supabase
        .from("helios_sessions")
        .select("*")
        .eq("session_id", session_id)
        .single();

      if (!session) {
        return new Response(JSON.stringify({ success: false, error: "Session not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let soapNote = session.soap_note;
      if (!soapNote && session.messages?.length > 0) {
        const oldcarts = session.oldcarts_data || createEmptyOLDCARTS(session.chief_complaint || "");
        soapNote = await generateSOAPNote(
          anthropic,
          session.messages,
          oldcarts,
          session.patient_info || {},
          (session.language || "en") as Language
        );
      }

      const completedAt = new Date().toISOString();
      const userMessages = (session.messages || [])
        .filter((m: { role: string }) => m.role === "user")
        .map((m: { content: string }) => m.content)
        .join(". ")
        .substring(0, 500);

      let disposition = session.disposition;
      if (!disposition && session.triage_level) {
        if (session.triage_level <= 2) disposition = 'emergency';
        else if (session.triage_level === 3) disposition = 'urgent_care';
        else if (session.triage_level === 4) disposition = 'primary_care';
        else disposition = 'self_care';
      }

      const completeUpdate: Record<string, unknown> = {
        current_phase: "completed",
        completed_at: completedAt,
        updated_at: completedAt,
        summary: userMessages || "No symptoms recorded",
        disposition,
      };

      if (soapNote) {
        completeUpdate.soap_note = soapNote;
      }

      if (user_id && typeof user_id === 'string' && user_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        completeUpdate.patient_info = {
          ...(session.patient_info || {}),
          external_user_id: user_id,
        };
      }

      const { error: updateErr } = await supabase
        .from("helios_sessions")
        .update(completeUpdate)
        .eq("session_id", session_id);

      if (updateErr) {
        console.error("[HELIOS] Failed to update session:", updateErr);
      }

      await syncToDevProject(devSupabase, "helios_sessions", "update", completeUpdate, "session_id", session_id);

      return new Response(JSON.stringify({
        success: true,
        session_id: session_id,
        summary: userMessages,
        soap_note: soapNote,
        disposition: disposition,
        triage_level: session.triage_level,
        oldcarts_progress: session.oldcarts_data?.completenessPercentage || 0,
        completed_at: completedAt,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========================================
    // ACTION: GET SESSION
    // ========================================
    if (action === "get" || action === "get_session") {
      if (!session_id) {
        return new Response(JSON.stringify({ success: false, error: "session_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: sess, error: getErr } = await supabase
        .from("helios_sessions")
        .select("*")
        .eq("session_id", session_id)
        .single();

      if (getErr || !sess) {
        return new Response(JSON.stringify({ success: false, error: "Session not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const uiTriggers = {
        showAssessment: sess.consensus_result != null || sess.current_phase === 'plan' || sess.current_phase === 'documentation' || sess.current_phase === 'completed',
        showBooking: (sess.triage_level && sess.triage_level >= 3) || sess.current_phase === 'plan',
        showEmergency: sess.current_phase === 'escalated' || (sess.triage_level && sess.triage_level <= 2),
        showSummary: sess.current_phase === 'completed',
      };

      return new Response(JSON.stringify({
        success: true,
        session_id: sess.session_id,
        user_id: sess.user_id,
        current_phase: sess.current_phase,
        phase: sess.current_phase,
        specialty: sess.specialty,
        language: sess.language,
        messages: sess.messages || [],
        patient_info: sess.patient_info || {},
        oldcarts_data: sess.oldcarts_data,
        oldcarts_progress: sess.oldcarts_data?.completenessPercentage || 0,
        red_flags: sess.red_flags || [],
        triage_level: sess.triage_level,
        consensus: sess.consensus_result,
        created_at: sess.created_at,
        updated_at: sess.updated_at,
        completed_at: sess.completed_at,
        summary: sess.summary,
        chief_complaint: sess.chief_complaint,
        disposition: sess.disposition,
        soap_note: sess.soap_note,
        ui_triggers: uiTriggers,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========================================
    // ACTION: LIST USER SESSIONS
    // ========================================
    if (action === "list_sessions") {
      if (!user_id) {
        return new Response(JSON.stringify({ success: false, error: "user_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: sessions, error: listErr } = await supabase
        .from("helios_sessions")
        .select("*")
        .or(`user_id.eq.${user_id},patient_info->>external_user_id.eq.${user_id}`)
        .order("created_at", { ascending: false })
        .limit(50);

      if (listErr) {
        return new Response(JSON.stringify({ success: false, error: listErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const mappedSessions = (sessions || []).map((s: Record<string, unknown>) => ({
        session_id: s.session_id,
        user_id: s.user_id,
        specialty: s.specialty || 'primary-care',
        current_phase: s.current_phase || 'intake',
        chief_complaint: s.chief_complaint || null,
        triage_level: s.triage_level || null,
        oldcarts_progress: (s.oldcarts_data as OLDCARTSData | null)?.completenessPercentage || 0,
        created_at: s.created_at,
        updated_at: s.updated_at,
        completed_at: s.completed_at || null,
        summary: s.summary || null,
        disposition: s.disposition || null,
      }));

      return new Response(JSON.stringify({
        success: true,
        sessions: mappedSessions,
        count: mappedSessions.length,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========================================
    // ACTION: CREATE BOOKING
    // ========================================
    if (action === "create_booking") {
      if (!session_id) {
        return new Response(JSON.stringify({ success: false, error: "session_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const booking = body.booking as {
        scheduled_at: string;
        specialty: string;
        include_soap_note: boolean;
        payment_method: string;
      };

      if (!booking || !booking.scheduled_at) {
        return new Response(JSON.stringify({ success: false, error: "booking data required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const booking_id = crypto.randomUUID();

      let soap_note = null;
      if (booking.include_soap_note) {
        const { data: sessionData } = await supabase
          .from("helios_sessions")
          .select("soap_note")
          .eq("session_id", session_id)
          .single();
        soap_note = sessionData?.soap_note || null;
      }

      const bookingData: Record<string, unknown> = {
        booking_id,
        session_id,
        user_id: user_id || null,
        scheduled_at: booking.scheduled_at,
        specialty: booking.specialty,
        payment_method: booking.payment_method,
        status: "confirmed",
        soap_note_shared: booking.include_soap_note,
        created_at: new Date().toISOString(),
      };

      await supabase.from("helios_bookings").insert(bookingData);

      await supabase
        .from("helios_sessions")
        .update({
          booking_id,
          updated_at: new Date().toISOString(),
        })
        .eq("session_id", session_id);

      return new Response(JSON.stringify({
        success: true,
        booking_id,
        session_id,
        scheduled_at: booking.scheduled_at,
        specialty: booking.specialty,
        soap_note_shared: booking.include_soap_note,
        message: `Your video visit has been scheduled for ${new Date(booking.scheduled_at).toLocaleString()}. You'll receive a confirmation email shortly.`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========================================
    // ACTION: INTAKE (legacy support)
    // ========================================
    if (action === "intake") {
      await supabase
        .from("helios_sessions")
        .update({ patient_info: patient_info, updated_at: new Date().toISOString() })
        .eq("session_id", session_id);

      return new Response(JSON.stringify({
        success: true,
        session_id: session_id,
        message: language === 'es' ? "Gracias. ¿Cuál es tu preocupación?" :
                 language === 'fr' ? "Merci. Quelle est votre préoccupation?" :
                 "Thanks. What is your concern?",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========================================
    // ACTION: GENERATE SOAP PDF
    // ========================================
    if (action === "generate_soap_pdf") {
      if (!session_id) {
        return new Response(JSON.stringify({ success: false, error: "session_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch session data including SOAP note and consensus
      const { data: session, error: sessionError } = await supabase
        .from("helios_sessions")
        .select("*")
        .eq("session_id", session_id)
        .single();

      if (sessionError || !session) {
        return new Response(JSON.stringify({ success: false, error: "Session not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get consensus result if available
      const { data: consensus } = await supabase
        .from("helios_consensus_results")
        .select("*")
        .eq("session_id", session_id)
        .single();

      // Build SOAP note data for PDF
      const soapNote = session.soap_note || {};
      const patientInfo = session.patient_info || {};

      const pdfData = {
        title: "HELIOS AI Consult - SOAP Note",
        generated: new Date().toISOString(),
        sessionId: session_id,
        patient: {
          age: patientInfo.age || "Not provided",
          sex: patientInfo.sex || "Not provided",
        },
        chiefComplaint: session.chief_complaint || "Not documented",
        triageLevel: session.triage_level || consensus?.final_urgency?.esi_level || null,
        disposition: session.disposition || consensus?.final_urgency?.disposition || null,
        sections: {
          subjective: typeof soapNote.subjective === 'string'
            ? [soapNote.subjective]
            : soapNote.subjective || ["Chief complaint and history of present illness as documented in consultation."],
          objective: typeof soapNote.objective === 'string'
            ? [soapNote.objective]
            : soapNote.objective || ["Vital signs and physical examination findings to be obtained by healthcare provider."],
          assessment: typeof soapNote.assessment === 'string'
            ? [soapNote.assessment]
            : soapNote.assessment || [
                consensus?.primary_diagnosis?.diagnosis || "Assessment pending clinical evaluation.",
                ...(consensus?.differential_diagnosis?.slice(0, 3).map((d: any) =>
                  `Differential: ${d.diagnosis} (${d.confidence}% confidence)`
                ) || [])
              ],
          plan: typeof soapNote.plan === 'string'
            ? [soapNote.plan]
            : soapNote.plan || [
                ...(consensus?.plan_of_action?.lab_tests?.slice(0, 3) || []),
                ...(consensus?.plan_of_action?.imaging?.slice(0, 2) || []),
                ...(consensus?.plan_of_action?.referrals?.slice(0, 2) || []),
                "Follow up with healthcare provider as recommended."
              ].filter(Boolean),
        },
        redFlags: consensus?.red_flags_identified || [],
        disclaimer: language === 'es'
          ? "Este resumen generado por IA es solo para fines informativos y no constituye consejo médico. Consulte con un profesional de la salud licenciado."
          : language === 'fr'
          ? "Ce résumé généré par l'IA est uniquement à titre informatif et ne constitue pas un avis médical. Veuillez consulter un professionnel de la santé agréé."
          : "This AI-generated summary is for informational purposes only and does not constitute medical advice. Please consult with a licensed healthcare provider.",
        footer: "Generated by HELIOS AI Health Assistant - SwissVault.ai",
        consultDate: session.created_at,
        expertCount: consensus?.experts_consulted || 0,
        agreementScore: consensus?.agreement_score || null,
      };

      return new Response(JSON.stringify({
        success: true,
        pdf_data: pdfData,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========================================
    // ACTION: SUBMIT FEEDBACK
    // ========================================
    if (action === "submit_feedback") {
      const rating = body.rating as string;
      const comment = body.comment as string | undefined;

      // Validate rating
      if (!rating || !['not-helpful', 'so-so', 'helpful'].includes(rating)) {
        return new Response(JSON.stringify({
          success: false,
          error: "Invalid rating. Must be 'not-helpful', 'so-so', or 'helpful'."
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get session context for feedback analytics
      let sessionContext: Record<string, unknown> = {
        timestamp: new Date().toISOString(),
      };

      if (session_id) {
        const { data: session } = await supabase
          .from("helios_sessions")
          .select("triage_level, specialty, current_phase, consensus_result")
          .eq("session_id", session_id)
          .single();

        if (session) {
          sessionContext = {
            ...sessionContext,
            triage_level: session.triage_level,
            specialty: session.specialty,
            phase: session.current_phase,
            had_consensus: session.consensus_result != null,
            kendall_w: session.consensus_result?.kendallW || null,
          };
        }
      }

      // Insert feedback
      const { error: feedbackError } = await supabase
        .from("helios_feedback")
        .insert({
          session_id: session_id || null,
          user_id: user_id || null,
          rating,
          comment: comment || null,
          context: sessionContext,
        });

      if (feedbackError) {
        console.error("[HELIOS] Feedback error:", feedbackError);
        return new Response(JSON.stringify({
          success: false,
          error: feedbackError.message
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Sync to dev project
      await syncToDevProject(devSupabase, "helios_feedback", "insert", {
        session_id: session_id || null,
        user_id: user_id || null,
        rating,
        comment: comment || null,
        context: sessionContext,
      });

      return new Response(JSON.stringify({
        success: true,
        message: "Thank you for your feedback!",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: false, error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("HELIOS error:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
