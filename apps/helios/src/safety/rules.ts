/**
 * HELIOS Deterministic Safety Rules
 * These rules are evaluated WITHOUT LLM - pure logic
 * They CANNOT be overridden or bypassed
 */

import type { SupportedLanguage } from '../config/languages.js';
import type { Severity, RedFlag } from '../types/index.js';
import { generateUUID, now } from '../utils/index.js';

// Patient state for rule evaluation
export interface PatientState {
  age?: number;
  ageUnit?: 'years' | 'months' | 'days';
  sex?: 'male' | 'female' | 'other';
  pregnant?: boolean;
  gestationalWeeks?: number;
  symptoms: string[];
  temperature?: number;  // Fahrenheit
  temperatureCelsius?: number;
  riskFactors: string[];
  medications: string[];
  messages: string[];  // Conversation history for keyword detection
}

// Rule definition
export interface SafetyRule {
  ruleId: string;
  name: Record<SupportedLanguage, string>;
  category: 'cardiac' | 'neuro' | 'respiratory' | 'psychiatric' | 'pediatric' | 'obstetric' | 'sepsis' | 'bleeding' | 'allergy';
  severity: Severity;
  escalationLevel: 'emergency' | 'urgent' | 'flag_only';
  condition: (state: PatientState) => boolean;
  action: Record<SupportedLanguage, string>;
  emergencyNumber: Record<SupportedLanguage, string>;
}

// ============================================
// CARDIAC RULES
// ============================================

const CARDIAC_CHEST_PAIN: SafetyRule = {
  ruleId: 'cardiac_001',
  name: {
    en: 'Chest Pain with Risk Factors',
    es: 'Dolor Torácico con Factores de Riesgo',
    fr: 'Douleur Thoracique avec Facteurs de Risque',
  },
  category: 'cardiac',
  severity: 'critical',
  escalationLevel: 'emergency',
  condition: (state) => {
    const chestPainKeywords = [
      'chest pain', 'chest pressure', 'chest tightness', 'chest discomfort',
      'dolor de pecho', 'presión en el pecho', 'opresión en el pecho',
      'douleur thoracique', 'pression thoracique', 'oppression thoracique',
    ];

    const hasChestPain = state.symptoms.some(s =>
      chestPainKeywords.some(k => s.toLowerCase().includes(k))
    ) || state.messages.some(m =>
      chestPainKeywords.some(k => m.toLowerCase().includes(k))
    );

    const hasRiskFactors =
      (state.age && state.ageUnit === 'years' && state.age >= 40) ||
      state.riskFactors.some(r =>
        ['diabetes', 'hypertension', 'smoking', 'smoker', 'high blood pressure',
         'heart disease', 'cardiac history', 'family history cardiac',
         'diabético', 'hipertensión', 'fumador', 'diabétique', 'hypertendu', 'fumeur'
        ].some(rf => r.toLowerCase().includes(rf))
      );

    return hasChestPain && hasRiskFactors;
  },
  action: {
    en: 'EMERGENCY: Chest pain with cardiac risk factors detected. Call 911 immediately.',
    es: 'EMERGENCIA: Dolor torácico con factores de riesgo cardíaco detectado. Llame al 911 inmediatamente.',
    fr: 'URGENCE: Douleur thoracique avec facteurs de risque cardiaque détectée. Appelez le 15 immédiatement.',
  },
  emergencyNumber: { en: '911', es: '911', fr: '15' },
};

const CARDIAC_RADIATING_PAIN: SafetyRule = {
  ruleId: 'cardiac_002',
  name: {
    en: 'Radiating Chest Pain',
    es: 'Dolor Torácico Irradiado',
    fr: 'Douleur Thoracique Irradiante',
  },
  category: 'cardiac',
  severity: 'critical',
  escalationLevel: 'emergency',
  condition: (state) => {
    const radiatingKeywords = [
      'radiating to arm', 'radiating to jaw', 'pain in left arm', 'pain down arm',
      'irradia al brazo', 'irradia a la mandíbula', 'dolor en el brazo izquierdo',
      'irradie au bras', 'irradie à la mâchoire', 'douleur dans le bras gauche',
    ];

    return state.symptoms.some(s =>
      radiatingKeywords.some(k => s.toLowerCase().includes(k))
    ) || state.messages.some(m =>
      radiatingKeywords.some(k => m.toLowerCase().includes(k))
    );
  },
  action: {
    en: 'EMERGENCY: Chest pain radiating to arm/jaw suggests cardiac event. Call 911.',
    es: 'EMERGENCIA: Dolor torácico que irradia al brazo/mandíbula sugiere evento cardíaco. Llame al 911.',
    fr: 'URGENCE: Douleur thoracique irradiant au bras/mâchoire suggère événement cardiaque. Appelez le 15.',
  },
  emergencyNumber: { en: '911', es: '911', fr: '15' },
};

// ============================================
// NEUROLOGICAL RULES
// ============================================

const NEURO_STROKE_FAST: SafetyRule = {
  ruleId: 'neuro_001',
  name: {
    en: 'Stroke Symptoms (FAST)',
    es: 'Síntomas de Derrame (FAST)',
    fr: 'Symptômes d\'AVC (FAST)',
  },
  category: 'neuro',
  severity: 'critical',
  escalationLevel: 'emergency',
  condition: (state) => {
    const strokeKeywords = [
      'facial droop', 'face drooping', 'arm weakness', 'arm weak', 'arm numb',
      'speech difficulty', 'slurred speech', 'can\'t speak', 'trouble speaking',
      'sudden severe headache', 'worst headache', 'thunderclap headache',
      // Spanish
      'caída facial', 'cara caída', 'debilidad del brazo', 'brazo débil',
      'dificultad para hablar', 'habla arrastrada', 'dolor de cabeza severo',
      // French
      'affaissement facial', 'visage tombant', 'faiblesse du bras', 'bras faible',
      'difficulté à parler', 'parole confuse', 'mal de tête sévère',
    ];

    return state.symptoms.some(s =>
      strokeKeywords.some(k => s.toLowerCase().includes(k))
    ) || state.messages.some(m =>
      strokeKeywords.some(k => m.toLowerCase().includes(k))
    );
  },
  action: {
    en: 'EMERGENCY: Possible stroke. Time is critical. Call 911 immediately. Note symptom onset time.',
    es: 'EMERGENCIA: Posible derrame cerebral. El tiempo es crítico. Llame al 911 inmediatamente. Note la hora de inicio.',
    fr: 'URGENCE: AVC possible. Le temps est critique. Appelez le 15 immédiatement. Notez l\'heure de début.',
  },
  emergencyNumber: { en: '911', es: '911', fr: '15' },
};

const NEURO_ALTERED_MENTAL: SafetyRule = {
  ruleId: 'neuro_002',
  name: {
    en: 'Altered Mental Status',
    es: 'Estado Mental Alterado',
    fr: 'État Mental Altéré',
  },
  category: 'neuro',
  severity: 'critical',
  escalationLevel: 'emergency',
  condition: (state) => {
    const alteredKeywords = [
      'confused', 'disoriented', 'not making sense', 'loss of consciousness',
      'passed out', 'fainted', 'unresponsive', 'acting strange', 'not themselves',
      'confundido', 'desorientado', 'pérdida de conciencia', 'desmayó',
      'confus', 'désorienté', 'perte de conscience', 'évanoui',
    ];

    return state.symptoms.some(s =>
      alteredKeywords.some(k => s.toLowerCase().includes(k))
    ) || state.messages.some(m =>
      alteredKeywords.some(k => m.toLowerCase().includes(k))
    );
  },
  action: {
    en: 'EMERGENCY: Altered mental status requires immediate evaluation. Call 911.',
    es: 'EMERGENCIA: Estado mental alterado requiere evaluación inmediata. Llame al 911.',
    fr: 'URGENCE: État mental altéré nécessite évaluation immédiate. Appelez le 15.',
  },
  emergencyNumber: { en: '911', es: '911', fr: '15' },
};

// ============================================
// RESPIRATORY RULES
// ============================================

const RESP_SEVERE_DISTRESS: SafetyRule = {
  ruleId: 'resp_001',
  name: {
    en: 'Severe Respiratory Distress',
    es: 'Dificultad Respiratoria Severa',
    fr: 'Détresse Respiratoire Sévère',
  },
  category: 'respiratory',
  severity: 'critical',
  escalationLevel: 'emergency',
  condition: (state) => {
    const distressKeywords = [
      'can\'t breathe', 'cannot breathe', 'gasping', 'blue lips', 'blue fingers',
      'can\'t speak', 'speaking in words only', 'tripod position',
      'no puedo respirar', 'jadeando', 'labios azules', 'no puedo hablar',
      'ne peut pas respirer', 'haletant', 'lèvres bleues', 'ne peut pas parler',
    ];

    return state.symptoms.some(s =>
      distressKeywords.some(k => s.toLowerCase().includes(k))
    ) || state.messages.some(m =>
      distressKeywords.some(k => m.toLowerCase().includes(k))
    );
  },
  action: {
    en: 'EMERGENCY: Severe breathing difficulty. Call 911 immediately. Sit upright, stay calm.',
    es: 'EMERGENCIA: Dificultad respiratoria severa. Llame al 911 inmediatamente. Siéntese erguido, mantenga la calma.',
    fr: 'URGENCE: Difficulté respiratoire sévère. Appelez le 15 immédiatement. Restez assis, gardez votre calme.',
  },
  emergencyNumber: { en: '911', es: '911', fr: '15' },
};

// ============================================
// PSYCHIATRIC RULES
// ============================================

const PSYCH_SUICIDE: SafetyRule = {
  ruleId: 'psych_001',
  name: {
    en: 'Suicidal Ideation',
    es: 'Ideación Suicida',
    fr: 'Idéation Suicidaire',
  },
  category: 'psychiatric',
  severity: 'critical',
  escalationLevel: 'emergency',
  condition: (state) => {
    const suicideKeywords = [
      'kill myself', 'want to die', 'end my life', 'suicide', 'suicidal',
      'better off dead', 'no reason to live', 'don\'t want to be here',
      'have a plan', 'going to hurt myself', 'self harm',
      'matarme', 'quiero morir', 'terminar mi vida', 'suicidio', 'suicida',
      'me tuer', 'veux mourir', 'mettre fin à ma vie', 'suicide', 'suicidaire',
    ];

    return state.messages.some(m =>
      suicideKeywords.some(k => m.toLowerCase().includes(k))
    ) || state.symptoms.some(s =>
      suicideKeywords.some(k => s.toLowerCase().includes(k))
    );
  },
  action: {
    en: 'CRISIS: Your life matters. Please call 988 (Suicide Prevention) immediately for support.',
    es: 'CRISIS: Tu vida importa. Por favor llama al 024 (Prevención del Suicidio) inmediatamente.',
    fr: 'CRISE: Votre vie compte. Veuillez appeler le 3114 (Prévention du Suicide) immédiatement.',
  },
  emergencyNumber: { en: '988', es: '024', fr: '3114' },
};

// ============================================
// PEDIATRIC RULES
// ============================================

const PEDS_INFANT_FEVER: SafetyRule = {
  ruleId: 'peds_001',
  name: {
    en: 'Infant Fever (<3 months)',
    es: 'Fiebre en Lactante (<3 meses)',
    fr: 'Fièvre du Nourrisson (<3 mois)',
  },
  category: 'pediatric',
  severity: 'critical',
  escalationLevel: 'emergency',
  condition: (state) => {
    const isInfant = state.ageUnit === 'months' && state.age !== undefined && state.age < 3;
    const isNewborn = state.ageUnit === 'days';

    const hasFever =
      (state.temperature && state.temperature >= 100.4) ||
      (state.temperatureCelsius && state.temperatureCelsius >= 38) ||
      state.symptoms.some(s => s.toLowerCase().includes('fever')) ||
      state.messages.some(m =>
        m.toLowerCase().includes('fever') ||
        m.toLowerCase().includes('fiebre') ||
        m.toLowerCase().includes('fièvre')
      );

    return (isInfant || isNewborn) && hasFever;
  },
  action: {
    en: 'EMERGENCY: Fever in infant <3 months requires immediate ER evaluation. Do not give medication.',
    es: 'EMERGENCIA: Fiebre en lactante <3 meses requiere evaluación de emergencia inmediata. No dar medicamentos.',
    fr: 'URGENCE: Fièvre chez nourrisson <3 mois nécessite évaluation urgente immédiate. Ne pas donner de médicaments.',
  },
  emergencyNumber: { en: '911', es: '911', fr: '15' },
};

const PEDS_RESP_DISTRESS: SafetyRule = {
  ruleId: 'peds_002',
  name: {
    en: 'Pediatric Respiratory Distress',
    es: 'Dificultad Respiratoria Pediátrica',
    fr: 'Détresse Respiratoire Pédiatrique',
  },
  category: 'pediatric',
  severity: 'critical',
  escalationLevel: 'emergency',
  condition: (state) => {
    const isPediatric = state.ageUnit !== 'years' || (state.age !== undefined && state.age < 18);

    const respDistressKeywords = [
      'retractions', 'nasal flaring', 'grunting', 'head bobbing', 'lethargic',
      'blue', 'tripod', 'can\'t breathe', 'struggling to breathe',
      'retracciones', 'aleteo nasal', 'gruñidos', 'letárgico', 'azul',
      'rétractions', 'battement des ailes du nez', 'grognement', 'léthargique', 'bleu',
    ];

    const hasRespDistress = state.symptoms.some(s =>
      respDistressKeywords.some(k => s.toLowerCase().includes(k))
    ) || state.messages.some(m =>
      respDistressKeywords.some(k => m.toLowerCase().includes(k))
    );

    return isPediatric && hasRespDistress;
  },
  action: {
    en: 'EMERGENCY: Child has breathing difficulty. Call 911 immediately.',
    es: 'EMERGENCIA: El niño tiene dificultad para respirar. Llame al 911 inmediatamente.',
    fr: 'URGENCE: L\'enfant a des difficultés respiratoires. Appelez le 15 immédiatement.',
  },
  emergencyNumber: { en: '911', es: '911', fr: '15' },
};

// ============================================
// OBSTETRIC RULES
// ============================================

const OB_BLEEDING: SafetyRule = {
  ruleId: 'ob_001',
  name: {
    en: 'Pregnancy with Bleeding',
    es: 'Embarazo con Sangrado',
    fr: 'Grossesse avec Saignement',
  },
  category: 'obstetric',
  severity: 'critical',
  escalationLevel: 'emergency',
  condition: (state) => {
    const isPregnant = state.pregnant === true ||
      state.messages.some(m =>
        m.toLowerCase().includes('pregnant') ||
        m.toLowerCase().includes('embarazada') ||
        m.toLowerCase().includes('enceinte')
      );

    const hasBleedingKeywords = [
      'bleeding', 'blood', 'spotting', 'hemorrhage',
      'sangrado', 'sangre', 'manchado', 'hemorragia',
      'saignement', 'sang', 'spotting', 'hémorragie',
    ];

    const hasBleeding = state.symptoms.some(s =>
      hasBleedingKeywords.some(k => s.toLowerCase().includes(k))
    ) || state.messages.some(m =>
      hasBleedingKeywords.some(k => m.toLowerCase().includes(k))
    );

    return isPregnant && hasBleeding;
  },
  action: {
    en: 'EMERGENCY: Bleeding during pregnancy requires immediate evaluation. Call 911 or go to ER.',
    es: 'EMERGENCIA: Sangrado durante el embarazo requiere evaluación inmediata. Llame al 911 o vaya a urgencias.',
    fr: 'URGENCE: Saignement pendant la grossesse nécessite évaluation immédiate. Appelez le 15 ou allez aux urgences.',
  },
  emergencyNumber: { en: '911', es: '911', fr: '15' },
};

// ============================================
// ALLERGY/ANAPHYLAXIS RULES
// ============================================

const ALLERGY_ANAPHYLAXIS: SafetyRule = {
  ruleId: 'allergy_001',
  name: {
    en: 'Anaphylaxis Symptoms',
    es: 'Síntomas de Anafilaxia',
    fr: 'Symptômes d\'Anaphylaxie',
  },
  category: 'allergy',
  severity: 'critical',
  escalationLevel: 'emergency',
  condition: (state) => {
    const anaphylaxisKeywords = [
      'throat swelling', 'tongue swelling', 'can\'t swallow', 'hives all over',
      'face swelling', 'lips swelling', 'difficulty breathing', 'wheezing',
      'hinchazón de garganta', 'hinchazón de lengua', 'urticaria', 'hinchazón facial',
      'gonflement de la gorge', 'gonflement de la langue', 'urticaire', 'gonflement du visage',
    ];

    return state.symptoms.some(s =>
      anaphylaxisKeywords.some(k => s.toLowerCase().includes(k))
    ) || state.messages.some(m =>
      anaphylaxisKeywords.some(k => m.toLowerCase().includes(k))
    );
  },
  action: {
    en: 'EMERGENCY: Signs of severe allergic reaction. Use EpiPen if available. Call 911 immediately.',
    es: 'EMERGENCIA: Signos de reacción alérgica severa. Use EpiPen si está disponible. Llame al 911.',
    fr: 'URGENCE: Signes de réaction allergique sévère. Utilisez EpiPen si disponible. Appelez le 15.',
  },
  emergencyNumber: { en: '911', es: '911', fr: '15' },
};

// ============================================
// BLEEDING RULES
// ============================================

const BLEEDING_SEVERE: SafetyRule = {
  ruleId: 'bleed_001',
  name: {
    en: 'Severe/Uncontrolled Bleeding',
    es: 'Sangrado Severo/Incontrolado',
    fr: 'Saignement Sévère/Incontrôlé',
  },
  category: 'bleeding',
  severity: 'critical',
  escalationLevel: 'emergency',
  condition: (state) => {
    const severeBleedingKeywords = [
      'won\'t stop bleeding', 'can\'t stop bleeding', 'soaking through',
      'spurting', 'pulsing blood', 'a lot of blood', 'heavy bleeding',
      'no para de sangrar', 'mucha sangre', 'sangrado abundante',
      'n\'arrête pas de saigner', 'beaucoup de sang', 'saignement abondant',
    ];

    return state.symptoms.some(s =>
      severeBleedingKeywords.some(k => s.toLowerCase().includes(k))
    ) || state.messages.some(m =>
      severeBleedingKeywords.some(k => m.toLowerCase().includes(k))
    );
  },
  action: {
    en: 'EMERGENCY: Apply direct pressure with clean cloth. Call 911. Keep pressure until help arrives.',
    es: 'EMERGENCIA: Aplique presión directa con tela limpia. Llame al 911. Mantenga presión hasta que llegue ayuda.',
    fr: 'URGENCE: Appliquez une pression directe avec un tissu propre. Appelez le 15. Maintenez la pression.',
  },
  emergencyNumber: { en: '911', es: '911', fr: '15' },
};

// ============================================
// ALL RULES COLLECTION
// ============================================

export const SAFETY_RULES: SafetyRule[] = [
  // Cardiac
  CARDIAC_CHEST_PAIN,
  CARDIAC_RADIATING_PAIN,
  // Neurological
  NEURO_STROKE_FAST,
  NEURO_ALTERED_MENTAL,
  // Respiratory
  RESP_SEVERE_DISTRESS,
  // Psychiatric
  PSYCH_SUICIDE,
  // Pediatric
  PEDS_INFANT_FEVER,
  PEDS_RESP_DISTRESS,
  // Obstetric
  OB_BLEEDING,
  // Allergy
  ALLERGY_ANAPHYLAXIS,
  // Bleeding
  BLEEDING_SEVERE,
];

// ============================================
// RULE ENGINE
// ============================================

export interface SafetyCheckResult {
  triggered: boolean;
  redFlags: RedFlag[];
  requiresEscalation: boolean;
  escalationReason?: string;
  highestSeverity?: Severity;
}

/**
 * Check all safety rules against patient state
 * This is DETERMINISTIC - no LLM involved
 */
export function checkSafetyRules(
  state: PatientState,
  language: SupportedLanguage
): SafetyCheckResult {
  const redFlags: RedFlag[] = [];
  let requiresEscalation = false;
  let escalationReason: string | undefined;
  let highestSeverity: Severity | undefined;

  for (const rule of SAFETY_RULES) {
    try {
      if (rule.condition(state)) {
        const redFlag: RedFlag = {
          flag_id: generateUUID(),
          rule_id: rule.ruleId,
          flag_type: rule.category,
          description: rule.name[language],
          severity: rule.severity,
          escalation_level: rule.escalationLevel,
          action_taken: rule.action[language],
          detected_at: now(),
        };

        redFlags.push(redFlag);

        if (rule.escalationLevel === 'emergency') {
          requiresEscalation = true;
          escalationReason = rule.action[language];
        }

        // Track highest severity
        const severityOrder: Severity[] = ['low', 'moderate', 'high', 'critical'];
        if (!highestSeverity ||
            severityOrder.indexOf(rule.severity) > severityOrder.indexOf(highestSeverity)) {
          highestSeverity = rule.severity;
        }
      }
    } catch (error) {
      // Log but don't fail - safety rules should be robust
      console.error(`Error evaluating rule ${rule.ruleId}:`, error);
    }
  }

  return {
    triggered: redFlags.length > 0,
    redFlags,
    requiresEscalation,
    escalationReason,
    highestSeverity,
  };
}

/**
 * Get emergency number for a specific condition type
 */
export function getEmergencyNumber(
  ruleId: string,
  language: SupportedLanguage
): string {
  const rule = SAFETY_RULES.find(r => r.ruleId === ruleId);
  return rule?.emergencyNumber[language] || (language === 'fr' ? '15' : '911');
}
