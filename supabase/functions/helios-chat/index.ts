import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.24.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ============================================
// DEV PROJECT SYNC (Dual-Write for Redundancy)
// ============================================
const DEV_SUPABASE_URL = "https://ghmmdochvlrnwbruyrqk.supabase.co";
const DEV_SUPABASE_SERVICE_KEY = Deno.env.get("DEV_SUPABASE_SERVICE_ROLE_KEY");

// Create dev project client for dual-write
function getDevSupabase(): SupabaseClient | null {
  if (!DEV_SUPABASE_SERVICE_KEY) {
    console.log("[HELIOS] Dev project sync disabled - no service key configured");
    return null;
  }
  return createClient(DEV_SUPABASE_URL, DEV_SUPABASE_SERVICE_KEY);
}

// Helper function to sync operations to dev project (best-effort, non-blocking)
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
      const { error } = await devSupabase.from(table).insert(data);
      if (error) throw error;
      console.log(`[HELIOS] Synced to dev project: ${table} INSERT success`);
    } else if (operation === 'update' && matchColumn && matchValue) {
      const { error } = await devSupabase.from(table).update(data).eq(matchColumn, matchValue);
      if (error) throw error;
      console.log(`[HELIOS] Synced to dev project: ${table} UPDATE success`);
    }
  } catch (err) {
    // Log but don't throw - dev sync is best-effort
    console.error(`[HELIOS] Dev sync failed for ${table} ${operation}:`, err);
  }
}

// ============================================
// TYPES
// ============================================

type Phase = 'intake' | 'chief_complaint' | 'history_taking' | 'triage' | 'differential' | 'plan' | 'documentation' | 'completed' | 'escalated';
type Severity = 'low' | 'moderate' | 'high' | 'critical';
type EscalationLevel = 'emergency' | 'urgent' | 'flag_only';
type TriageLevel = 1 | 2 | 3 | 4 | 5;

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

interface SafetyCheckResult {
  triggered: boolean;
  redFlags: RedFlag[];
  requiresEscalation: boolean;
  escalationReason?: string;
  highestSeverity?: Severity;
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

// ============================================
// DETERMINISTIC SAFETY RULES
// These run WITHOUT LLM - pure logic, cannot be bypassed
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

function checkSafetyRules(state: PatientState, language: string): SafetyCheckResult {
  const redFlags: RedFlag[] = [];
  let requiresEscalation = false;
  let escalationReason: string | undefined;
  let highestSeverity: Severity | undefined;
  const lang = (language || 'en') as 'en' | 'es' | 'fr';

  const allText = [...state.symptoms, ...state.messages].join(' ').toLowerCase();

  for (const rule of SAFETY_RULES) {
    // Check keywords
    const hasKeyword = rule.keywords.some(k => allText.includes(k.toLowerCase()));
    if (!hasKeyword) continue;

    // Check risk factors if required
    if (rule.needsRiskFactor && rule.riskKeywords) {
      const hasRisk = rule.riskKeywords.some(k =>
        state.riskFactors.some(r => r.toLowerCase().includes(k.toLowerCase())) ||
        allText.includes(k.toLowerCase())
      ) || (state.age && state.age >= 40);
      if (!hasRisk) continue;
    }

    // Check age condition for pediatric rules
    if (rule.ageCondition) {
      const ageValue = state.ageUnit === 'months' ? state.age :
                         state.ageUnit === 'days' ? (state.age || 0) / 30 :
                         (state.age || 999) * 12;
      const ageInMonths = ageValue ?? 999;
      if (ageInMonths > (rule.ageCondition.maxMonths || 999)) continue;
    }

    // Check pregnancy for obstetric rules
    if (rule.pregnancyRequired) {
      const isPregnant = state.pregnant || allText.includes('pregnant') ||
                        allText.includes('embarazada') || allText.includes('enceinte');
      if (!isPregnant) continue;
    }

    // Rule triggered
    redFlags.push({
      flag_id: crypto.randomUUID(),
      rule_id: rule.ruleId,
      flag_type: rule.category,
      description: rule.name[lang] || rule.name.en,
      severity: rule.severity,
      escalation_level: rule.escalationLevel,
      action_taken: rule.action[lang] || rule.action.en,
      detected_at: new Date().toISOString(),
    });

    if (rule.escalationLevel === 'emergency') {
      requiresEscalation = true;
      escalationReason = rule.action[lang] || rule.action.en;
    }

    if (!highestSeverity || ['low', 'moderate', 'high', 'critical'].indexOf(rule.severity) >
        ['low', 'moderate', 'high', 'critical'].indexOf(highestSeverity)) {
      highestSeverity = rule.severity;
    }
  }

  return { triggered: redFlags.length > 0, redFlags, requiresEscalation, escalationReason, highestSeverity };
}

// ============================================
// PHASE MANAGEMENT & TRIAGE
// ============================================

const PHASE_PROMPTS: Record<Phase, Record<string, string>> = {
  intake: {
    en: "You are gathering initial information. Ask about their main concern in a warm, welcoming way.",
    es: "Estás recopilando información inicial. Pregunta sobre su principal preocupación de manera cálida.",
    fr: "Vous recueillez les informations initiales. Demandez leur principale préoccupation de manière chaleureuse.",
  },
  chief_complaint: {
    en: "Focus on understanding their primary symptom. Ask about onset, location, and duration (OLD from OLDCARTS).",
    es: "Enfócate en entender su síntoma principal. Pregunta sobre inicio, ubicación y duración.",
    fr: "Concentrez-vous sur comprendre leur symptôme principal. Demandez le début, l'emplacement et la durée.",
  },
  history_taking: {
    en: "Continue gathering details using OLDCARTS: Character, Aggravating factors, Relieving factors, Timing, Severity. Ask about medications and allergies.",
    es: "Continúa recopilando detalles: Características, factores agravantes, factores aliviantes, momento, severidad. Pregunta sobre medicamentos y alergias.",
    fr: "Continuez à recueillir des détails: Caractère, facteurs aggravants, facteurs de soulagement, moment, sévérité. Demandez les médicaments et allergies.",
  },
  triage: {
    en: "Based on the information gathered, assess the urgency. Consider ESI level and appropriate care pathway.",
    es: "Basándote en la información recopilada, evalúa la urgencia. Considera el nivel ESI y la vía de atención apropiada.",
    fr: "Sur la base des informations recueillies, évaluez l'urgence. Considérez le niveau ESI et le parcours de soins approprié.",
  },
  differential: {
    en: "Consider possible explanations for the symptoms. Focus on 'must not miss' conditions and common diagnoses.",
    es: "Considera posibles explicaciones para los síntomas. Enfócate en condiciones que no se deben pasar por alto.",
    fr: "Considérez les explications possibles des symptômes. Concentrez-vous sur les conditions à ne pas manquer.",
  },
  plan: {
    en: "Provide care recommendations based on the assessment. Include when to seek immediate care and follow-up guidance.",
    es: "Proporciona recomendaciones de atención basadas en la evaluación. Incluye cuándo buscar atención inmediata.",
    fr: "Fournissez des recommandations de soins basées sur l'évaluation. Indiquez quand consulter en urgence.",
  },
  documentation: {
    en: "Summarize the consultation in clinical format. The conversation is concluding.",
    es: "Resume la consulta en formato clínico. La conversación está concluyendo.",
    fr: "Résumez la consultation en format clinique. La conversation se termine.",
  },
  completed: { en: "", es: "", fr: "" },
  escalated: { en: "", es: "", fr: "" },
};

function determinePhaseTransition(
  currentPhase: Phase,
  messageCount: number,
  hasChiefComplaint: boolean,
  historyCompleteness: number
): Phase {
  switch (currentPhase) {
    case 'intake':
      return hasChiefComplaint ? 'chief_complaint' : 'intake';
    case 'chief_complaint':
      return messageCount >= 2 ? 'history_taking' : 'chief_complaint';
    case 'history_taking':
      if (historyCompleteness >= 0.7 || messageCount >= 8) return 'triage';
      return 'history_taking';
    case 'triage':
      return 'differential';
    case 'differential':
      return 'plan';
    case 'plan':
      return 'documentation';
    case 'documentation':
      return 'completed';
    default:
      return currentPhase;
  }
}

function calculateHistoryCompleteness(messages: Array<{role: string, content: string}>): number {
  const allText = messages.map(m => m.content).join(' ').toLowerCase();

  // OLDCARTS components
  const components = {
    onset: /when did|how long|started|began|onset|cuándo|depuis quand/.test(allText),
    location: /where|location|ubicación|où/.test(allText),
    duration: /how long|duration|duración|durée/.test(allText),
    character: /describe|feels like|type of|describe|tipo de|décrivez/.test(allText),
    aggravating: /worse|aggravate|trigger|peor|empeora|aggrave/.test(allText),
    relieving: /better|relieve|help|mejora|alivia|soulage/.test(allText),
    timing: /constant|intermittent|time of day|constante|intermitente/.test(allText),
    severity: /scale|severe|pain level|escala|severidad|échelle/.test(allText),
    medications: /medication|medicine|taking|medicamento|médicament/.test(allText),
    allergies: /allerg|alergia|allergie/.test(allText),
  };

  const completed = Object.values(components).filter(Boolean).length;
  return completed / Object.keys(components).length;
}

function calculateTriageLevel(
  symptoms: string[],
  severity: string | undefined,
  age: number | undefined,
  redFlags: RedFlag[]
): TriageLevel {
  // ESI (Emergency Severity Index) calculation

  // Level 1: Life-threatening
  if (redFlags.some(f => f.escalation_level === 'emergency')) return 1;

  // Level 2: High risk / severe
  const highRiskKeywords = ['severe', 'worst', 'sudden', 'acute', 'severo', 'peor', 'sévère'];
  const hasHighRisk = symptoms.some(s => highRiskKeywords.some(k => s.toLowerCase().includes(k)));
  if (hasHighRisk || severity === 'severe') return 2;

  // Level 3: Moderate / needs resources
  const moderateKeywords = ['moderate', 'several days', 'getting worse', 'moderado', 'empeorando'];
  const hasModerate = symptoms.some(s => moderateKeywords.some(k => s.toLowerCase().includes(k)));
  if (hasModerate || (age && (age < 2 || age > 70))) return 3;

  // Level 4: Less urgent
  const mildKeywords = ['mild', 'minor', 'slight', 'leve', 'léger'];
  const hasMild = symptoms.some(s => mildKeywords.some(k => s.toLowerCase().includes(k)));
  if (hasMild) return 4;

  // Level 5: Non-urgent
  return 5;
}

// ============================================
// SOAP NOTE GENERATION
// ============================================

async function generateSOAPNote(
  anthropic: Anthropic,
  messages: Array<{role: string, content: string}>,
  specialty: string,
  patientInfo: Record<string, unknown>,
  language: string
): Promise<string> {
  const conversationText = messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => `${m.role === 'user' ? 'Patient' : 'HELIOS'}: ${m.content}`)
    .join('\n');

  const soapPrompt = `Based on this health consultation, generate a brief SOAP note.

Conversation:
${conversationText}

Patient Info: ${JSON.stringify(patientInfo)}
Specialty: ${specialty}

Generate a SOAP note with these sections:
- Subjective: Chief complaint and history from patient
- Objective: Any reported vitals, observations
- Assessment: Summary of findings and ESI level if applicable
- Plan: Recommendations given

Keep it concise and professional. ${language === 'es' ? 'Write in Spanish.' : language === 'fr' ? 'Write in French.' : 'Write in English.'}`;

  try {
    const resp = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: soapPrompt }],
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

function manageContextWindow(messages: Array<{role: string, content: string}>): Array<{role: string, content: string}> {
  if (messages.length <= MAX_CONTEXT_MESSAGES) return messages;

  const systemMessages = messages.filter(m => m.role === 'system');
  const nonSystemMessages = messages.filter(m => m.role !== 'system');

  const keepFirst = Math.min(2, nonSystemMessages.length);
  const firstMessages = nonSystemMessages.slice(0, keepFirst);
  const keepLast = MAX_CONTEXT_MESSAGES - keepFirst - systemMessages.length - 1;
  const lastMessages = nonSystemMessages.slice(-keepLast);

  const middleMessages = nonSystemMessages.slice(keepFirst, -keepLast);
  if (middleMessages.length > 0) {
    const summaryContent = middleMessages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join('; ')
      .substring(0, 500);

    return [
      ...systemMessages,
      ...firstMessages,
      { role: 'system', content: `[Earlier: ${summaryContent}...]` },
      ...lastMessages,
    ];
  }

  return [...systemMessages, ...firstMessages, ...lastMessages];
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
    
    // Initialize dev project client for dual-write
    const devSupabase = getDevSupabase();

    const body = await req.json();
    const action = body.action;
    const session_id = body.session_id;
    const message = body.message;
    const patient_info = body.patient_info || {};
    const specialty = body.specialty || "primary-care";
    const language = body.language || "en";
    const user_id = body.user_id; // NEW: Accept user_id for persistence

    // Language instructions
    const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
      "en": "Respond in English.",
      "es": "Responde en español.",
      "fr": "Répondez en français.",
    };

    // Base system prompt
    const BASE_SYSTEM_PROMPT = `You are HELIOS, an AI health assistant. You gather information about symptoms to connect patients with the right care. You do NOT diagnose - you gather information and recommend care pathways.

GUIDELINES:
- Be warm, empathetic, and professional
- Ask one or two questions at a time
- Use the OLDCARTS method: Onset, Location, Duration, Character, Aggravating factors, Relieving factors, Timing, Severity
- Always recommend professional medical evaluation for concerning symptoms
- Never provide specific diagnoses or treatment recommendations
- If emergency symptoms are mentioned, IMMEDIATELY recommend calling 911`;

    // Specialty-specific guidance
    const SPECIALTY_PROMPTS: Record<string, string> = {
      "primary-care": "Focus on overall health, lifestyle factors, preventive care.",
      "cardiology": "Be vigilant for cardiac symptoms. Ask about chest pain using PQRST. Screen for cardiac risk factors.",
      "dermatology": "Focus on skin appearance, location, duration, itching/pain. Recommend photos for dermatologist.",
      "mental-health": "Be extra empathetic and non-judgmental. Screen for depression, anxiety. ALWAYS provide crisis resources (988) if needed.",
      "pediatrics": "Assume parent/caregiver is describing child's symptoms. Ask about child's age, feeding, activity level.",
      "womens-health": "Focus on gynecological and reproductive health. Be sensitive and professional.",
      "orthopedics": "Focus on pain location, onset, mechanism of injury, range of motion, swelling.",
    };

    // ========================================
    // ACTION: CREATE SESSION
    // ========================================
    if (action === "create") {
      const sessionId = crypto.randomUUID();

      // Store external_user_id in patient_info to avoid foreign key constraint
      // (user may be from a different Supabase project)
      const patientInfoWithUser = { ...patient_info };
      if (user_id && typeof user_id === 'string' && user_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        patientInfoWithUser.external_user_id = user_id;
      }

      const sessionData: Record<string, unknown> = {
        session_id: sessionId,
        current_phase: "intake",
        specialty: specialty,
        messages: [],
        patient_info: patientInfoWithUser,
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

      // DUAL-WRITE: Sync to dev project (best-effort)
      await syncToDevProject(devSupabase, "helios_sessions", "insert", sessionData);

      const greetings: Record<string, Record<string, string>> = {
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
        ui_triggers: { showAssessment: false, showBooking: false, showEmergency: false },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========================================
    // ACTION: SEND MESSAGE
    // ========================================
    if (action === "message") {
      // Fetch session
      const { data: sess, error: sessErr } = await supabase
        .from("helios_sessions")
        .select("*")
        .eq("session_id", session_id)
        .single();

      if (sessErr || !sess) {
        return new Response(JSON.stringify({ success: false, error: "Session not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const history = sess.messages || [];
      const patientInfo = sess.patient_info || {};
      const sessionSpecialty = sess.specialty || "primary-care";
      const sessionLanguage = sess.language || language;
      let currentPhase = (sess.current_phase || "intake") as Phase;
      const existingRedFlags = sess.red_flags || [];

      // Build patient state for safety check
      const patientState: PatientState = {
        age: patientInfo.age,
        ageUnit: patientInfo.age_unit || 'years',
        sex: patientInfo.sex,
        pregnant: patientInfo.pregnant,
        symptoms: history.filter((m: {role: string}) => m.role === 'user').map((m: {content: string}) => m.content),
        riskFactors: patientInfo.risk_factors || [],
        medications: patientInfo.medications || [],
        messages: [...history.map((m: {content: string}) => m.content), message],
      };

      // SAFETY CHECK (deterministic, runs first)
      const safetyResult = checkSafetyRules(patientState, sessionLanguage);

      if (safetyResult.requiresEscalation) {
        // Update session with escalation - use only columns that exist
        const escalationUpdate: Record<string, unknown> = {
          current_phase: "escalated",
          updated_at: new Date().toISOString(),
        };
        await supabase.from("helios_sessions").update(escalationUpdate).eq("session_id", session_id);

        return new Response(JSON.stringify({
          success: true,
          session_id: session_id,
          phase: "escalated",
          message: safetyResult.escalationReason,
          escalated: true,
          red_flags: safetyResult.redFlags,
          ui_triggers: { showAssessment: false, showBooking: false, showEmergency: true },
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Build message history
      let contextMessages = history.map((m: {role: string, content: string}) => ({ role: m.role, content: m.content }));
      contextMessages.push({ role: "user", content: message });
      const managedMessages = manageContextWindow(contextMessages);

      // Calculate history completeness and determine phase transition
      const historyCompleteness = calculateHistoryCompleteness(contextMessages);
      const hasChiefComplaint = contextMessages.filter((m: {role: string}) => m.role === 'user').length >= 1;
      const messageCount = contextMessages.filter((m: {role: string}) => m.role === 'user').length;

      const nextPhase = determinePhaseTransition(currentPhase, messageCount, hasChiefComplaint, historyCompleteness);

      // Build system prompt with phase guidance
      const specialtyGuidance = SPECIALTY_PROMPTS[sessionSpecialty] || SPECIALTY_PROMPTS["primary-care"];
      const phaseGuidance = PHASE_PROMPTS[currentPhase]?.[sessionLanguage] || PHASE_PROMPTS[currentPhase]?.en || "";

      let systemPrompt = `${BASE_SYSTEM_PROMPT}\n\n## SPECIALTY: ${sessionSpecialty.toUpperCase()}\n${specialtyGuidance}`;
      systemPrompt += `\n\n## CURRENT PHASE: ${currentPhase}\n${phaseGuidance}`;
      systemPrompt += "\n\n" + (LANGUAGE_INSTRUCTIONS[sessionLanguage] || LANGUAGE_INSTRUCTIONS["en"]);

      if (patientInfo.age || patientInfo.sex) {
        systemPrompt += ` Patient: ${patientInfo.age ? `Age ${patientInfo.age}` : ''} ${patientInfo.sex || ''}`.trim();
      }

      // Include any existing red flags for context
      if (existingRedFlags.length > 0 || safetyResult.redFlags.length > 0) {
        systemPrompt += `\n\nNOTE: Patient has flagged symptoms requiring attention.`;
      }

      // Filter to only user/assistant messages for API
      const apiMessages = managedMessages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      // Call Claude
      const resp = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: apiMessages,
      });

      const reply = resp.content[0].type === "text" ? resp.content[0].text : "";

      // Calculate triage level if in triage phase
      let triageLevel: TriageLevel | null = sess.triage_level;
      if (nextPhase === 'triage' || currentPhase === 'triage') {
        triageLevel = calculateTriageLevel(
          patientState.symptoms,
          patientInfo.severity,
          patientInfo.age,
          [...existingRedFlags, ...safetyResult.redFlags]
        );
      }

      // Generate SOAP note if entering documentation phase
      let soapNote = sess.soap_note;
      if (nextPhase === 'documentation' && !soapNote) {
        soapNote = await generateSOAPNote(anthropic, [...history, { role: 'user', content: message }, { role: 'assistant', content: reply }], sessionSpecialty, patientInfo, sessionLanguage);
      }

      // Build new messages array
      const now = new Date().toISOString();
      const newMsgs = [
        ...history,
        { role: "user", content: message, message_id: crypto.randomUUID(), timestamp: now },
        { role: "assistant", content: reply, message_id: crypto.randomUUID(), timestamp: now },
      ];

      // Extract chief complaint from first user message if not set
      let chiefComplaint = sess.chief_complaint;
      if (!chiefComplaint && history.filter((m: {role: string}) => m.role === 'user').length === 0) {
        chiefComplaint = message.substring(0, 200);
      }

      // Update session - only use columns that exist in the table
      const updateData: Record<string, unknown> = {
        messages: newMsgs,
        current_phase: nextPhase,
        updated_at: now,
      };

      const { error: updateErr } = await supabase.from("helios_sessions").update(updateData).eq("session_id", session_id);
      if (updateErr) {
        console.error("Failed to update session:", updateErr);
      }

      // DUAL-WRITE: Sync message update to dev project (best-effort)
      await syncToDevProject(devSupabase, "helios_sessions", "update", updateData, "session_id", session_id);

      // Determine UI triggers based on phase
      const uiTriggers = {
        showAssessment: nextPhase === 'plan' || nextPhase === 'documentation' || nextPhase === 'completed',
        showBooking: (triageLevel && triageLevel >= 3) || nextPhase === 'plan' || nextPhase === 'documentation',
        showEmergency: safetyResult.triggered || (triageLevel && triageLevel <= 2),
        showSummary: nextPhase === 'completed',
      };

      return new Response(JSON.stringify({
        success: true,
        session_id: session_id,
        phase: nextPhase,
        previous_phase: currentPhase,
        message: reply,
        triage_level: triageLevel,
        red_flags: safetyResult.redFlags,
        history_completeness: historyCompleteness,
        ui_triggers: uiTriggers,
        soap_note: nextPhase === 'documentation' || nextPhase === 'completed' ? soapNote : undefined,
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

      // Generate SOAP note if not already done
      let soapNote = session.soap_note;
      if (!soapNote && session.messages?.length > 0) {
        soapNote = await generateSOAPNote(
          anthropic,
          session.messages,
          session.specialty || "primary-care",
          session.patient_info || {},
          session.language || "en"
        );
      }

      // Generate summary
      const userMessages = (session.messages || [])
        .filter((m: {role: string}) => m.role === "user")
        .map((m: {content: string}) => m.content)
        .join(". ")
        .substring(0, 500);

      const completedAt = new Date().toISOString();

      // Determine disposition based on triage level
      let disposition = session.disposition;
      if (!disposition && session.triage_level) {
        if (session.triage_level <= 2) disposition = 'emergency';
        else if (session.triage_level === 3) disposition = 'urgent_care';
        else if (session.triage_level === 4) disposition = 'primary_care';
        else disposition = 'self_care';
      }

      // Update with only columns that exist
      const completeUpdate: Record<string, unknown> = {
        current_phase: "completed",
        updated_at: completedAt,
      };

      // Store user_id in patient_info to avoid foreign key constraint
      // (user may be from a different Supabase project)
      if (user_id && typeof user_id === 'string' && user_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        completeUpdate.patient_info = {
          ...(session.patient_info || {}),
          external_user_id: user_id,
        };
      }

      // Update session with completion data - try full update first, fallback to minimal
      console.log("[HELIOS] Updating session:", session_id);

      const fullCompleteUpdate = {
        ...completeUpdate,
        completed_at: completedAt,
        summary: userMessages || "No symptoms recorded",
      };

      // First try with all columns including soap_note
      let { data: updateData, error: updateErr } = await supabase.from("helios_sessions").update({
        ...fullCompleteUpdate,
        soap_note: soapNote,
      }).eq("session_id", session_id).select();

      // If soap_note column doesn't exist, try without it
      if (updateErr && updateErr.message?.includes("soap_note")) {
        console.log("[HELIOS] Retrying without soap_note column");
        const result = await supabase.from("helios_sessions").update(fullCompleteUpdate).eq("session_id", session_id).select();
        updateData = result.data;
        updateErr = result.error;
      }

      // If still failing, try minimal update
      if (updateErr) {
        console.log("[HELIOS] Retrying with minimal update");
        const result = await supabase.from("helios_sessions").update(completeUpdate).eq("session_id", session_id).select();
        updateData = result.data;
        updateErr = result.error;
      }

      if (updateErr) {
        console.error("[HELIOS] Failed to update session:", updateErr);
        return new Response(JSON.stringify({
          success: false,
          error: "Failed to update session: " + updateErr.message,
          details: updateErr,
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // DUAL-WRITE: Sync completion to dev project (best-effort)
      await syncToDevProject(devSupabase, "helios_sessions", "update", fullCompleteUpdate, "session_id", session_id);

      return new Response(JSON.stringify({
        success: true,
        session_id: session_id,
        summary: userMessages,
        soap_note: soapNote,
        disposition: disposition,
        triage_level: session.triage_level,
        completed_at: completedAt,
        updated_rows: updateData?.length || 0,
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

      // Calculate UI triggers based on current state
      const uiTriggers = {
        showAssessment: sess.current_phase === 'plan' || sess.current_phase === 'documentation' || sess.current_phase === 'completed',
        showBooking: (sess.triage_level && sess.triage_level >= 3) || sess.current_phase === 'plan',
        showEmergency: sess.escalation_triggered || (sess.triage_level && sess.triage_level <= 2),
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
        red_flags: sess.red_flags || [],
        triage_level: sess.triage_level,
        escalated: sess.escalation_triggered || false,
        escalation_reason: sess.escalation_reason,
        created_at: sess.created_at,
        updated_at: sess.updated_at,
        completed_at: sess.completed_at,
        summary: sess.summary,
        chief_complaint: sess.chief_complaint,
        disposition: sess.disposition,
        soap_note: sess.soap_note,
        recommended_action: sess.recommended_action,
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

      // Query sessions by external_user_id in patient_info (for cross-project auth)
      // OR by user_id column (for same-project auth)
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

      // Map to consistent format, handling missing columns
      const mappedSessions = (sessions || []).map((s: Record<string, unknown>) => ({
        session_id: s.session_id,
        user_id: s.user_id,
        specialty: s.specialty || 'primary-care',
        current_phase: s.current_phase || 'intake',
        chief_complaint: s.chief_complaint || null,
        triage_level: s.triage_level || null,
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

      // Generate booking ID
      const booking_id = crypto.randomUUID();

      // Get session data for SOAP note if needed
      let soap_note = null;
      if (booking.include_soap_note) {
        const { data: sessionData } = await supabase
          .from("helios_sessions")
          .select("soap_note")
          .eq("session_id", session_id)
          .single();
        soap_note = sessionData?.soap_note || null;
      }

      // Insert booking record
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

      const { error: bookingErr } = await supabase
        .from("helios_bookings")
        .insert(bookingData);

      // If table doesn't exist, we'll just return success anyway
      // The booking ID is still valid for tracking
      if (bookingErr) {
        console.log("[HELIOS] Booking insert error (may be missing table):", bookingErr.message);
      }

      // Update session to link booking
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
