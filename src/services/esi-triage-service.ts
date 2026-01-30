/**
 * ESI Triage Service
 * Implements the Emergency Severity Index (ESI) v5 Algorithm
 *
 * The ESI is a five-level triage algorithm that stratifies patients into
 * five groups from 1 (most urgent) to 5 (least urgent) based on acuity
 * and expected resource needs.
 *
 * Reference: Agency for Healthcare Research and Quality (AHRQ)
 * ESI Implementation Handbook, Version 5
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface VitalSigns {
  heartRate?: number; // beats per minute
  respiratoryRate?: number; // breaths per minute
  systolicBP?: number; // mmHg
  diastolicBP?: number; // mmHg
  temperature?: number; // Celsius
  spO2?: number; // percentage (0-100)
  painLevel?: number; // 0-10 scale
}

export type MentalStatus = 'alert' | 'confused' | 'lethargic' | 'unresponsive';

export interface ESIInput {
  symptoms: string[];
  vitalSigns?: VitalSigns;
  age?: number;
  chiefComplaint: string;
  painLevel?: number;
  mentalStatus?: MentalStatus;
  medicalHistory?: string[];
  medications?: string[];
  isPregnant?: boolean;
  isImmunocompromised?: boolean;
}

export type ESILevel = 1 | 2 | 3 | 4 | 5;

export interface DecisionPointResult {
  point: 'A' | 'B' | 'C' | 'D';
  triggered: boolean;
  criteria: string[];
  notes?: string;
}

export interface ResourcePrediction {
  labs: boolean;
  ecg: boolean;
  imaging: {
    xray: boolean;
    ct: boolean;
    mri: boolean;
    ultrasound: boolean;
  };
  ivFluids: boolean;
  ivMedications: boolean;
  imMedications: boolean;
  nebulizer: boolean;
  specialtyConsult: boolean;
  procedures: string[];
  totalCount: number;
}

export interface RedFlagMatch {
  category: string;
  flag: string;
  severity: 'critical' | 'high' | 'moderate';
  matchedSymptoms: string[];
}

export interface ESIAssessment {
  level: ESILevel;
  levelDescription: string;
  decisionPoints: DecisionPointResult[];
  redFlagsPresent: RedFlagMatch[];
  resourcesExpected: ResourcePrediction;
  reasoning: string;
  recommendations: string[];
  reassessmentInterval?: string;
  confidence: number;
}

// ============================================================================
// RED FLAGS by Body System
// ============================================================================

export const RED_FLAGS = {
  neurological: {
    critical: [
      'unresponsive',
      'unconscious',
      'active seizure',
      'status epilepticus',
      'gcs less than 8',
      'posturing',
      'decerebrate',
      'decorticate',
    ],
    high: [
      'thunderclap headache',
      'worst headache of life',
      'worst headache ever',
      'sudden severe headache',
      'new focal deficit',
      'focal neurological deficit',
      'facial droop',
      'face drooping',
      'arm weakness',
      'leg weakness',
      'one sided weakness',
      'hemiparesis',
      'hemiplegia',
      'slurred speech',
      'speech difficulty',
      'aphasia',
      'dysarthria',
      'sudden vision loss',
      'double vision',
      'diplopia',
      'neck stiffness',
      'nuchal rigidity',
      'photophobia',
      'altered mental status',
      'confusion',
      'disorientation',
      'new onset confusion',
      'meningeal signs',
    ],
    moderate: [
      'persistent headache',
      'recurring headache',
      'headache with fever',
      'dizziness with falls',
      'vertigo',
      'syncope',
      'fainting',
      'transient weakness',
      'numbness',
      'tingling',
      'paresthesia',
    ],
  },

  cardiovascular: {
    critical: [
      'pulseless',
      'no pulse',
      'cardiac arrest',
      'asystole',
      'ventricular fibrillation',
      'v-fib',
      'pulseless vtach',
    ],
    high: [
      'chest pain',
      'chest tightness',
      'chest pressure',
      'crushing chest pain',
      'substernal chest pain',
      'radiating to arm',
      'radiating to jaw',
      'radiating to back',
      'diaphoresis',
      'sweating profusely',
      'cold sweats',
      'shortness of breath with chest pain',
      'dyspnea on exertion',
      'palpitations with syncope',
      'irregular heartbeat',
      'racing heart',
      'heart racing',
      'tachycardia',
      'bradycardia',
      'hypotension',
      'low blood pressure',
      'shock',
      'pale and diaphoretic',
      'cyanosis',
      'blue lips',
      'mottled skin',
      'severe leg swelling',
      'unilateral leg swelling',
      'calf pain and swelling',
      'possible dvt',
      'aortic dissection',
      'tearing back pain',
    ],
    moderate: [
      'mild chest discomfort',
      'palpitations',
      'edema',
      'swollen ankles',
      'leg swelling bilateral',
      'fatigue with exertion',
      'orthopnea',
      'paroxysmal nocturnal dyspnea',
    ],
  },

  respiratory: {
    critical: [
      'apneic',
      'apnea',
      'not breathing',
      'respiratory arrest',
      'severe respiratory distress',
      'agonal breathing',
      'gasping',
      'stridor',
      'upper airway obstruction',
      'choking',
      'complete airway obstruction',
      'anaphylaxis',
      'angioedema',
      'swollen tongue',
      'swollen throat',
    ],
    high: [
      'tripod positioning',
      'tripod position',
      'accessory muscle use',
      'retractions',
      'intercostal retractions',
      'nasal flaring',
      'cyanotic',
      'blue around lips',
      'severe shortness of breath',
      'cannot speak full sentences',
      'speaking in words only',
      'wheezing severe',
      'silent chest',
      'respiratory rate over 30',
      'tachypnea',
      'hypoxia',
      'oxygen saturation below 90',
      'spo2 below 90',
      'hemoptysis',
      'coughing blood',
      'massive hemoptysis',
      'pulmonary embolism',
      'sudden dyspnea',
      'pleuritic chest pain',
    ],
    moderate: [
      'productive cough',
      'persistent cough',
      'cough with fever',
      'mild shortness of breath',
      'wheezing',
      'bronchospasm',
      'asthma exacerbation',
      'copd exacerbation',
    ],
  },

  abdominal: {
    critical: [
      'massive gi bleeding',
      'hematemesis large volume',
      'bright red blood per rectum',
      'ruptured aaa',
      'abdominal aortic aneurysm rupture',
    ],
    high: [
      'rigid abdomen',
      'board-like abdomen',
      'guarding',
      'rebound tenderness',
      'peritoneal signs',
      'peritonitis',
      'severe abdominal pain',
      'acute abdomen',
      'abdominal pain with fever',
      'right lower quadrant pain with fever',
      'appendicitis',
      'left lower quadrant pain elderly',
      'diverticulitis',
      'epigastric pain radiating to back',
      'pancreatitis',
      'jaundice with fever',
      'cholangitis',
      'right upper quadrant pain with fever',
      'cholecystitis',
      'hematemesis',
      'vomiting blood',
      'coffee ground emesis',
      'melena',
      'black tarry stool',
      'hematochezia',
      'bloody stool',
      'ectopic pregnancy',
      'vaginal bleeding with abdominal pain',
      'testicular pain',
      'testicular torsion',
      'scrotal pain and swelling',
    ],
    moderate: [
      'nausea and vomiting',
      'abdominal cramping',
      'diarrhea',
      'constipation',
      'bloating',
      'heartburn',
      'mild abdominal pain',
    ],
  },

  psychiatric: {
    critical: [
      'actively suicidal',
      'suicide attempt',
      'intentional overdose',
      'self-harm in progress',
      'homicidal ideation with plan',
      'violent behavior',
      'acute psychosis with agitation',
    ],
    high: [
      'suicidal ideation',
      'want to kill myself',
      'want to die',
      'suicidal thoughts',
      'suicide plan',
      'homicidal ideation',
      'want to hurt someone',
      'command hallucinations',
      'hearing voices to harm',
      'psychosis',
      'hallucinations',
      'delusions',
      'paranoia',
      'severe agitation',
      'severe anxiety',
      'panic attack',
      'acute mania',
      'catatonia',
    ],
    moderate: [
      'depression',
      'anxiety',
      'insomnia',
      'mood changes',
      'feeling hopeless',
      'withdrawal symptoms',
    ],
  },

  trauma: {
    critical: [
      'major trauma',
      'multiple injuries',
      'penetrating trauma',
      'gunshot wound',
      'stab wound',
      'impaled object',
      'amputation',
      'severe burns',
      'burns over 20 percent',
      'near drowning',
      'hanging',
      'strangulation',
      'electrical injury',
      'high voltage injury',
    ],
    high: [
      'head injury with loc',
      'loss of consciousness',
      'head trauma',
      'skull fracture',
      'facial fracture',
      'neck injury',
      'spine injury',
      'back injury with weakness',
      'open fracture',
      'compound fracture',
      'dislocation',
      'pelvic fracture',
      'femur fracture',
      'crush injury',
      'compartment syndrome',
      'severe laceration',
      'uncontrolled bleeding',
      'significant blood loss',
      'fall from height',
      'motor vehicle accident',
      'mva',
      'assault',
      'domestic violence',
    ],
    moderate: [
      'minor laceration',
      'abrasion',
      'contusion',
      'sprain',
      'strain',
      'minor burns',
      'minor head injury no loc',
    ],
  },

  infectious: {
    critical: [
      'septic shock',
      'sepsis',
      'meningitis',
      'necrotizing fasciitis',
      'toxic shock syndrome',
    ],
    high: [
      'high fever over 39',
      'fever over 103',
      'fever with rash',
      'petechial rash',
      'purpura',
      'fever with rigors',
      'shaking chills',
      'fever in immunocompromised',
      'fever with neutropenia',
      'infection spreading rapidly',
      'cellulitis spreading',
      'abscess with systemic symptoms',
      'infected wound with red streaks',
      'fever in infant under 3 months',
      'fever in elderly with confusion',
    ],
    moderate: [
      'fever',
      'low grade fever',
      'flu symptoms',
      'upper respiratory infection',
      'uti symptoms',
      'localized infection',
    ],
  },

  metabolic_endocrine: {
    critical: [
      'diabetic ketoacidosis',
      'dka',
      'hyperosmolar state',
      'severe hypoglycemia',
      'blood sugar below 40',
      'adrenal crisis',
      'thyroid storm',
      'myxedema coma',
    ],
    high: [
      'hypoglycemia',
      'low blood sugar',
      'hyperglycemia with symptoms',
      'blood sugar over 400',
      'severe dehydration',
      'electrolyte abnormality',
      'hyponatremia',
      'hyperkalemia',
    ],
    moderate: [
      'mild dehydration',
      'diabetes poorly controlled',
      'thyroid symptoms',
    ],
  },

  allergic_immunologic: {
    critical: [
      'anaphylaxis',
      'anaphylactic shock',
      'angioedema',
      'swelling of airway',
      'severe allergic reaction',
    ],
    high: [
      'allergic reaction with breathing difficulty',
      'hives with wheezing',
      'allergic reaction spreading rapidly',
      'facial swelling',
      'lip swelling',
      'throat tightness',
    ],
    moderate: [
      'hives',
      'urticaria',
      'allergic reaction mild',
      'itching',
      'rash',
    ],
  },

  obstetric_gynecologic: {
    critical: [
      'postpartum hemorrhage',
      'eclampsia',
      'seizure in pregnancy',
      'prolapsed cord',
      'placental abruption',
      'uterine rupture',
    ],
    high: [
      'vaginal bleeding in pregnancy',
      'heavy vaginal bleeding',
      'preeclampsia',
      'severe headache in pregnancy',
      'severe abdominal pain pregnant',
      'decreased fetal movement',
      'no fetal movement',
      'preterm labor',
      'contractions before 37 weeks',
      'rupture of membranes preterm',
      'ectopic pregnancy suspected',
      'pelvic pain with positive pregnancy test',
      'sexual assault',
    ],
    moderate: [
      'spotting in pregnancy',
      'mild contractions',
      'vaginal discharge',
      'pelvic pain',
    ],
  },

  pediatric: {
    critical: [
      'infant not breathing',
      'newborn in distress',
      'febrile seizure ongoing',
      'infant floppy',
      'infant lethargic',
      'child unresponsive',
    ],
    high: [
      'fever in infant under 3 months',
      'fever under 28 days',
      'child not making eye contact',
      'inconsolable crying',
      'child refusing to walk',
      'limping child with fever',
      'petechial rash in child',
      'bulging fontanelle',
      'sunken fontanelle with dehydration',
      'child abuse suspected',
      'non accidental trauma',
    ],
    moderate: [
      'fever in child',
      'vomiting in child',
      'diarrhea in child',
      'ear pain',
      'sore throat in child',
    ],
  },

  ophthalmologic: {
    critical: [
      'chemical eye injury',
      'chemical burn to eye',
    ],
    high: [
      'sudden vision loss',
      'acute vision change',
      'eye trauma',
      'penetrating eye injury',
      'globe rupture',
      'severe eye pain',
      'acute glaucoma',
      'central retinal artery occlusion',
    ],
    moderate: [
      'red eye',
      'conjunctivitis',
      'eye discharge',
      'foreign body sensation eye',
      'mild eye pain',
    ],
  },

  environmental: {
    critical: [
      'hypothermia severe',
      'core temp below 32',
      'hyperthermia',
      'heat stroke',
      'core temp over 40',
      'lightning strike',
      'drowning',
      'near drowning',
    ],
    high: [
      'frostbite',
      'severe cold exposure',
      'heat exhaustion',
      'snake bite',
      'venomous bite',
      'spider bite black widow',
      'spider bite brown recluse',
      'bee sting with allergic reaction',
      'toxic exposure',
      'poisoning',
      'carbon monoxide exposure',
    ],
    moderate: [
      'mild hypothermia',
      'mild cold exposure',
      'sunburn',
      'insect bite',
      'minor animal bite',
    ],
  },
} as const;

// ============================================================================
// Resource Prediction Keywords
// ============================================================================

const RESOURCE_INDICATORS = {
  labs: [
    'blood test', 'lab work', 'cbc', 'complete blood count', 'bmp', 'cmp',
    'metabolic panel', 'troponin', 'cardiac enzymes', 'bnp', 'd-dimer',
    'coagulation', 'pt', 'inr', 'ptt', 'lipase', 'amylase', 'liver function',
    'renal function', 'creatinine', 'urinalysis', 'urine test', 'culture',
    'blood culture', 'urine culture', 'glucose', 'blood sugar', 'hba1c',
    'thyroid', 'tsh', 'lactate', 'blood gas', 'abg', 'electrolytes',
  ],
  ecg: [
    'chest pain', 'palpitations', 'irregular heartbeat', 'syncope', 'fainting',
    'shortness of breath', 'dyspnea', 'heart racing', 'bradycardia', 'tachycardia',
    'cardiac', 'heart', 'arrhythmia', 'atrial fibrillation', 'afib',
  ],
  xray: [
    'fracture', 'broken bone', 'fall', 'injury', 'trauma', 'cough', 'pneumonia',
    'chest pain', 'breathing difficulty', 'swallowed', 'foreign body', 'rib pain',
    'joint pain', 'dislocation', 'sprain',
  ],
  ct: [
    'head injury', 'stroke', 'worst headache', 'thunderclap', 'seizure',
    'abdominal pain severe', 'appendicitis', 'diverticulitis', 'kidney stone',
    'flank pain', 'pulmonary embolism', 'pe', 'aortic dissection', 'trauma major',
  ],
  mri: [
    'back pain with weakness', 'spine', 'cord compression', 'cauda equina',
    'new neurological deficit', 'soft tissue mass',
  ],
  ultrasound: [
    'gallbladder', 'right upper quadrant pain', 'cholecystitis', 'pregnancy',
    'pelvic pain', 'ovarian', 'testicular pain', 'dvt', 'leg swelling unilateral',
    'abdominal aortic aneurysm', 'aaa', 'appendicitis', 'kidney stone',
  ],
  ivFluids: [
    'dehydration', 'vomiting', 'diarrhea', 'unable to keep fluids down',
    'hypotension', 'low blood pressure', 'dizziness', 'lightheaded', 'dry mucous membranes',
    'tachycardia', 'sepsis', 'infection severe',
  ],
  ivMedications: [
    'severe pain', 'pain level 8', 'pain level 9', 'pain level 10',
    'infection severe', 'sepsis', 'antibiotics iv', 'seizure', 'status epilepticus',
    'anaphylaxis', 'severe allergic reaction', 'chest pain cardiac',
    'cardiac', 'asthma severe', 'copd exacerbation', 'respiratory distress',
  ],
  imMedications: [
    'allergic reaction', 'nausea severe', 'pain moderate', 'injection needed',
    'tetanus', 'im antibiotics',
  ],
  nebulizer: [
    'asthma', 'wheezing', 'copd', 'bronchospasm', 'respiratory distress',
    'shortness of breath', 'croup', 'stridor',
  ],
  specialtyConsult: [
    'cardiac', 'cardiology', 'neurology', 'stroke', 'surgery', 'surgical',
    'orthopedic', 'fracture', 'dislocation', 'psychiatry', 'suicidal',
    'ob/gyn', 'pregnancy complication', 'ent', 'ophthalmology', 'eye injury',
    'urology', 'gastroenterology', 'gi bleed', 'pulmonology',
  ],
  procedures: [
    { pattern: 'laceration|cut|wound', procedure: 'Wound repair/suturing' },
    { pattern: 'abscess|boil', procedure: 'Incision and drainage' },
    { pattern: 'dislocation', procedure: 'Joint reduction' },
    { pattern: 'fracture', procedure: 'Splinting/casting' },
    { pattern: 'foreign body', procedure: 'Foreign body removal' },
    { pattern: 'urinary retention|unable to urinate', procedure: 'Foley catheter' },
    { pattern: 'nosebleed|epistaxis', procedure: 'Nasal packing' },
    { pattern: 'lumbar puncture|meningitis', procedure: 'Lumbar puncture' },
    { pattern: 'chest tube|pneumothorax', procedure: 'Chest tube insertion' },
    { pattern: 'intubation|airway', procedure: 'Airway management' },
    { pattern: 'cardioversion|afib rapid', procedure: 'Cardioversion' },
    { pattern: 'central line|iv access difficult', procedure: 'Central line placement' },
  ],
};

// ============================================================================
// Pediatric Vital Sign Thresholds (age-specific)
// ============================================================================

interface PediatricVitalThresholds {
  minAge: number; // months
  maxAge: number; // months
  hrLow: number;
  hrHigh: number;
  rrHigh: number;
  sbpLow: number;
}

const PEDIATRIC_VITAL_THRESHOLDS: PediatricVitalThresholds[] = [
  { minAge: 0, maxAge: 3, hrLow: 100, hrHigh: 180, rrHigh: 60, sbpLow: 60 },
  { minAge: 3, maxAge: 12, hrLow: 100, hrHigh: 160, rrHigh: 45, sbpLow: 70 },
  { minAge: 12, maxAge: 36, hrLow: 90, hrHigh: 150, rrHigh: 40, sbpLow: 75 },
  { minAge: 36, maxAge: 72, hrLow: 80, hrHigh: 140, rrHigh: 35, sbpLow: 80 },
  { minAge: 72, maxAge: 144, hrLow: 70, hrHigh: 120, rrHigh: 30, sbpLow: 85 },
  { minAge: 144, maxAge: 216, hrLow: 60, hrHigh: 100, rrHigh: 25, sbpLow: 90 },
];

// ============================================================================
// Helper Functions
// ============================================================================

function normalizeText(text: string): string {
  return text.toLowerCase().trim();
}

function matchesAnyPattern(text: string, patterns: readonly string[]): string[] {
  const normalizedText = normalizeText(text);
  return patterns.filter(pattern =>
    normalizedText.includes(normalizeText(pattern))
  );
}

function checkRedFlags(
  symptoms: string[],
  chiefComplaint: string
): RedFlagMatch[] {
  const allText = [...symptoms, chiefComplaint].join(' ').toLowerCase();
  const matches: RedFlagMatch[] = [];

  for (const [category, severityLevels] of Object.entries(RED_FLAGS)) {
    for (const [severity, patterns] of Object.entries(severityLevels)) {
      const matchedPatterns = matchesAnyPattern(allText, patterns);
      if (matchedPatterns.length > 0) {
        matches.push({
          category,
          flag: matchedPatterns[0],
          severity: severity as 'critical' | 'high' | 'moderate',
          matchedSymptoms: matchedPatterns,
        });
      }
    }
  }

  // Sort by severity (critical > high > moderate)
  const severityOrder = { critical: 0, high: 1, moderate: 2 };
  return matches.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

function predictResources(
  symptoms: string[],
  chiefComplaint: string,
  vitalSigns?: VitalSigns
): ResourcePrediction {
  const allText = [...symptoms, chiefComplaint].join(' ').toLowerCase();
  const prediction: ResourcePrediction = {
    labs: false,
    ecg: false,
    imaging: {
      xray: false,
      ct: false,
      mri: false,
      ultrasound: false,
    },
    ivFluids: false,
    ivMedications: false,
    imMedications: false,
    nebulizer: false,
    specialtyConsult: false,
    procedures: [],
    totalCount: 0,
  };

  // Check each resource type
  if (matchesAnyPattern(allText, RESOURCE_INDICATORS.labs).length > 0) {
    prediction.labs = true;
  }

  if (matchesAnyPattern(allText, RESOURCE_INDICATORS.ecg).length > 0) {
    prediction.ecg = true;
  }

  if (matchesAnyPattern(allText, RESOURCE_INDICATORS.xray).length > 0) {
    prediction.imaging.xray = true;
  }

  if (matchesAnyPattern(allText, RESOURCE_INDICATORS.ct).length > 0) {
    prediction.imaging.ct = true;
  }

  if (matchesAnyPattern(allText, RESOURCE_INDICATORS.mri).length > 0) {
    prediction.imaging.mri = true;
  }

  if (matchesAnyPattern(allText, RESOURCE_INDICATORS.ultrasound).length > 0) {
    prediction.imaging.ultrasound = true;
  }

  if (matchesAnyPattern(allText, RESOURCE_INDICATORS.ivFluids).length > 0) {
    prediction.ivFluids = true;
  }

  if (matchesAnyPattern(allText, RESOURCE_INDICATORS.ivMedications).length > 0) {
    prediction.ivMedications = true;
  }

  if (matchesAnyPattern(allText, RESOURCE_INDICATORS.imMedications).length > 0) {
    prediction.imMedications = true;
  }

  if (matchesAnyPattern(allText, RESOURCE_INDICATORS.nebulizer).length > 0) {
    prediction.nebulizer = true;
  }

  if (matchesAnyPattern(allText, RESOURCE_INDICATORS.specialtyConsult).length > 0) {
    prediction.specialtyConsult = true;
  }

  // Check procedures
  for (const proc of RESOURCE_INDICATORS.procedures) {
    if (new RegExp(proc.pattern, 'i').test(allText)) {
      prediction.procedures.push(proc.procedure);
    }
  }

  // Also check based on vital signs
  if (vitalSigns) {
    if (vitalSigns.spO2 && vitalSigns.spO2 < 94) {
      prediction.labs = true; // ABG likely needed
    }
    if (vitalSigns.heartRate && (vitalSigns.heartRate > 120 || vitalSigns.heartRate < 50)) {
      prediction.ecg = true;
    }
  }

  // Calculate total count
  // Note: All X-rays count as 1 resource per ESI guidelines
  let count = 0;
  if (prediction.labs) count++;
  if (prediction.ecg) count++;
  if (prediction.imaging.xray) count++; // All plain films = 1 resource
  if (prediction.imaging.ct) count++;
  if (prediction.imaging.mri) count++;
  if (prediction.imaging.ultrasound) count++;
  if (prediction.ivFluids) count++;
  if (prediction.ivMedications) count++;
  if (prediction.imMedications) count++;
  if (prediction.nebulizer) count++;
  if (prediction.specialtyConsult) count++;
  count += prediction.procedures.length;

  prediction.totalCount = count;

  return prediction;
}

function getPediatricThresholds(ageMonths: number): PediatricVitalThresholds | null {
  return PEDIATRIC_VITAL_THRESHOLDS.find(
    t => ageMonths >= t.minAge && ageMonths < t.maxAge
  ) || null;
}

function checkVitalSignsAbnormal(
  vitalSigns: VitalSigns,
  age?: number
): { abnormal: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (!vitalSigns) {
    return { abnormal: false, reasons: [] };
  }

  // Determine if pediatric (under 18)
  const isPediatric = age !== undefined && age < 18;
  const ageMonths = age !== undefined ? age * 12 : undefined;

  if (isPediatric && ageMonths !== undefined) {
    const thresholds = getPediatricThresholds(ageMonths);
    if (thresholds) {
      if (vitalSigns.heartRate !== undefined) {
        if (vitalSigns.heartRate > thresholds.hrHigh) {
          reasons.push(`Tachycardia: HR ${vitalSigns.heartRate} (normal max ${thresholds.hrHigh} for age)`);
        }
        if (vitalSigns.heartRate < thresholds.hrLow) {
          reasons.push(`Bradycardia: HR ${vitalSigns.heartRate} (normal min ${thresholds.hrLow} for age)`);
        }
      }
      if (vitalSigns.respiratoryRate !== undefined && vitalSigns.respiratoryRate > thresholds.rrHigh) {
        reasons.push(`Tachypnea: RR ${vitalSigns.respiratoryRate} (normal max ${thresholds.rrHigh} for age)`);
      }
      if (vitalSigns.systolicBP !== undefined && vitalSigns.systolicBP < thresholds.sbpLow) {
        reasons.push(`Hypotension: SBP ${vitalSigns.systolicBP} (normal min ${thresholds.sbpLow} for age)`);
      }
    }
  } else {
    // Adult thresholds
    if (vitalSigns.heartRate !== undefined) {
      if (vitalSigns.heartRate > 100) {
        reasons.push(`Tachycardia: HR ${vitalSigns.heartRate} bpm`);
      }
      if (vitalSigns.heartRate < 50) {
        reasons.push(`Bradycardia: HR ${vitalSigns.heartRate} bpm`);
      }
    }
    if (vitalSigns.respiratoryRate !== undefined && vitalSigns.respiratoryRate > 20) {
      reasons.push(`Tachypnea: RR ${vitalSigns.respiratoryRate}/min`);
    }
    if (vitalSigns.systolicBP !== undefined && vitalSigns.systolicBP < 90) {
      reasons.push(`Hypotension: SBP ${vitalSigns.systolicBP} mmHg`);
    }
  }

  // Universal thresholds
  if (vitalSigns.spO2 !== undefined && vitalSigns.spO2 < 92) {
    reasons.push(`Hypoxia: SpO2 ${vitalSigns.spO2}%`);
  }
  if (vitalSigns.temperature !== undefined) {
    if (vitalSigns.temperature >= 38.5) {
      reasons.push(`Fever: ${vitalSigns.temperature}°C`);
    }
    if (vitalSigns.temperature < 35) {
      reasons.push(`Hypothermia: ${vitalSigns.temperature}°C`);
    }
  }

  return { abnormal: reasons.length > 0, reasons };
}

function getLevelDescription(level: ESILevel): string {
  const descriptions: Record<ESILevel, string> = {
    1: 'Resuscitation - Immediate life-saving intervention required',
    2: 'Emergent - High risk situation requiring rapid evaluation',
    3: 'Urgent - Stable but requires multiple resources',
    4: 'Less Urgent - Requires one resource',
    5: 'Non-Urgent - No resources needed',
  };
  return descriptions[level];
}

function getReassessmentInterval(level: ESILevel): string {
  const intervals: Record<ESILevel, string> = {
    1: 'Continuous monitoring',
    2: 'Every 15 minutes',
    3: 'Every 30-60 minutes',
    4: 'Every 60-120 minutes',
    5: 'As needed',
  };
  return intervals[level];
}

// ============================================================================
// Main Assessment Function
// ============================================================================

export function assessESI(input: ESIInput): ESIAssessment {
  const {
    symptoms,
    vitalSigns,
    age,
    chiefComplaint,
    painLevel,
    mentalStatus,
    isPregnant,
    isImmunocompromised,
  } = input;

  const decisionPoints: DecisionPointResult[] = [];
  const redFlags = checkRedFlags(symptoms, chiefComplaint);
  const resources = predictResources(symptoms, chiefComplaint, vitalSigns);
  const allText = [...symptoms, chiefComplaint].join(' ').toLowerCase();

  let level: ESILevel = 5;
  let reasoning = '';

  // ========================================================================
  // DECISION POINT A: Requires immediate life-saving intervention?
  // ========================================================================
  const pointACriteria: string[] = [];

  // Check for unresponsive/pulseless/apneic
  if (mentalStatus === 'unresponsive') {
    pointACriteria.push('Unresponsive mental status');
  }

  const criticalPatterns = [
    'pulseless', 'no pulse', 'cardiac arrest', 'not breathing', 'apnea',
    'respiratory arrest', 'active seizure', 'status epilepticus',
    'severe respiratory distress', 'anaphylaxis', 'anaphylactic shock',
  ];

  const matchedCritical = matchesAnyPattern(allText, criticalPatterns);
  if (matchedCritical.length > 0) {
    pointACriteria.push(`Critical presentation: ${matchedCritical.join(', ')}`);
  }

  // Check vital signs for life-threatening values
  if (vitalSigns?.spO2 !== undefined && vitalSigns.spO2 < 90) {
    pointACriteria.push(`Severe hypoxia: SpO2 ${vitalSigns.spO2}%`);
  }

  if (vitalSigns?.systolicBP !== undefined && vitalSigns.systolicBP < 70) {
    pointACriteria.push(`Severe hypotension: SBP ${vitalSigns.systolicBP} mmHg`);
  }

  // Check for critical red flags
  const criticalRedFlags = redFlags.filter(rf => rf.severity === 'critical');
  if (criticalRedFlags.length > 0) {
    pointACriteria.push(`Critical red flags: ${criticalRedFlags.map(rf => rf.flag).join(', ')}`);
  }

  const pointATriggered = pointACriteria.length > 0;
  decisionPoints.push({
    point: 'A',
    triggered: pointATriggered,
    criteria: pointACriteria,
    notes: pointATriggered ? 'Immediate life-saving intervention required' : undefined,
  });

  if (pointATriggered) {
    level = 1;
    reasoning = `ESI Level 1 assigned: Patient requires immediate life-saving intervention. ` +
      `Criteria met: ${pointACriteria.join('; ')}. Immediate resuscitation measures indicated.`;

    return buildAssessment(level, decisionPoints, redFlags, resources, reasoning);
  }

  // ========================================================================
  // DECISION POINT B: High-risk situation?
  // ========================================================================
  const pointBCriteria: string[] = [];

  // Altered mental status
  if (mentalStatus === 'confused' || mentalStatus === 'lethargic') {
    pointBCriteria.push(`Altered mental status: ${mentalStatus}`);
  }

  // Severe pain/distress (pain >= 7)
  const effectivePainLevel = painLevel ?? vitalSigns?.painLevel;
  if (effectivePainLevel !== undefined && effectivePainLevel >= 7) {
    pointBCriteria.push(`Severe pain: ${effectivePainLevel}/10`);
  }

  // High-risk symptom patterns
  const highRiskPatterns = [
    // ACS (Acute Coronary Syndrome)
    { patterns: ['chest pain', 'chest tightness'], qualifier: ['diaphoresis', 'radiating', 'shortness of breath', 'nausea'], name: 'Possible ACS' },
    // Stroke (FAST)
    { patterns: ['facial droop', 'face drooping', 'arm weakness', 'speech difficulty', 'slurred speech'], name: 'Possible stroke (FAST positive)' },
    // Thunderclap headache
    { patterns: ['worst headache', 'thunderclap', 'sudden severe headache'], name: 'Thunderclap headache - rule out SAH' },
    // Suicidal/homicidal ideation
    { patterns: ['suicidal', 'want to die', 'kill myself', 'homicidal', 'want to hurt'], name: 'Psychiatric emergency' },
    // Peritonitis
    { patterns: ['severe abdominal pain', 'rigid abdomen', 'rebound tenderness'], qualifier: ['fever'], name: 'Possible peritonitis' },
    // Sepsis
    { patterns: ['fever', 'infection'], qualifier: ['confusion', 'tachycardia', 'hypotension', 'immunocompromised'], name: 'Possible sepsis' },
  ];

  for (const pattern of highRiskPatterns) {
    const mainMatch = matchesAnyPattern(allText, pattern.patterns).length > 0;
    const qualifierMatch = !pattern.qualifier || matchesAnyPattern(allText, pattern.qualifier).length > 0;

    if (mainMatch && qualifierMatch) {
      pointBCriteria.push(pattern.name);
    }
  }

  // Pregnancy complications
  if (isPregnant) {
    const pregnancyEmergencies = [
      'vaginal bleeding', 'heavy bleeding', 'severe abdominal pain',
      'contractions', 'decreased fetal movement', 'headache', 'vision changes',
    ];
    if (matchesAnyPattern(allText, pregnancyEmergencies).length > 0) {
      pointBCriteria.push('Pregnancy complication');
    }
  }

  // Immunocompromised with fever
  if (isImmunocompromised && allText.includes('fever')) {
    pointBCriteria.push('Fever in immunocompromised patient');
  }

  // High-severity red flags
  const highRedFlags = redFlags.filter(rf => rf.severity === 'high');
  if (highRedFlags.length > 0) {
    pointBCriteria.push(`High-risk findings: ${highRedFlags.slice(0, 3).map(rf => rf.flag).join(', ')}`);
  }

  // Age-specific concerns
  if (age !== undefined) {
    if (age < 0.25 && allText.includes('fever')) { // Under 3 months
      pointBCriteria.push('Fever in infant under 3 months');
    }
    if (age >= 65 && (mentalStatus === 'confused' || allText.includes('fall'))) {
      pointBCriteria.push('Elderly patient with confusion or fall');
    }
  }

  const pointBTriggered = pointBCriteria.length > 0;
  decisionPoints.push({
    point: 'B',
    triggered: pointBTriggered,
    criteria: pointBCriteria,
    notes: pointBTriggered ? 'High-risk situation requiring emergent evaluation' : undefined,
  });

  if (pointBTriggered) {
    level = 2;
    reasoning = `ESI Level 2 assigned: High-risk situation identified. ` +
      `Criteria met: ${pointBCriteria.join('; ')}. Patient should not wait and requires prompt evaluation.`;

    return buildAssessment(level, decisionPoints, redFlags, resources, reasoning);
  }

  // ========================================================================
  // DECISION POINT C: Resource prediction
  // ========================================================================
  const pointCCriteria: string[] = [];

  // Build resource description
  const resourceList: string[] = [];
  if (resources.labs) resourceList.push('Labs');
  if (resources.ecg) resourceList.push('ECG');
  if (resources.imaging.xray) resourceList.push('X-ray');
  if (resources.imaging.ct) resourceList.push('CT');
  if (resources.imaging.mri) resourceList.push('MRI');
  if (resources.imaging.ultrasound) resourceList.push('Ultrasound');
  if (resources.ivFluids) resourceList.push('IV fluids');
  if (resources.ivMedications) resourceList.push('IV medications');
  if (resources.imMedications) resourceList.push('IM medications');
  if (resources.nebulizer) resourceList.push('Nebulizer');
  if (resources.specialtyConsult) resourceList.push('Specialty consult');
  if (resources.procedures.length > 0) {
    resourceList.push(...resources.procedures);
  }

  pointCCriteria.push(`Expected resources (${resources.totalCount}): ${resourceList.join(', ') || 'None'}`);

  // Determine level based on resource count
  if (resources.totalCount === 0) {
    level = 5;
    pointCCriteria.push('No resources expected - ESI 5');
  } else if (resources.totalCount === 1) {
    level = 4;
    pointCCriteria.push('Single resource expected - ESI 4');
  } else {
    level = 3; // Preliminary, may be upgraded at Decision Point D
    pointCCriteria.push('Multiple resources expected - preliminary ESI 3');
  }

  decisionPoints.push({
    point: 'C',
    triggered: true, // Always evaluated
    criteria: pointCCriteria,
    notes: `Resource prediction: ${resources.totalCount} resource(s)`,
  });

  // ========================================================================
  // DECISION POINT D: Vital signs risk assessment (only if Level 3)
  // ========================================================================
  if (level === 3 && vitalSigns) {
    const vitalCheck = checkVitalSignsAbnormal(vitalSigns, age);
    const pointDCriteria: string[] = [];

    if (vitalCheck.abnormal) {
      pointDCriteria.push(...vitalCheck.reasons);
      pointDCriteria.push('Abnormal vital signs in ESI 3 patient - consider upgrading to ESI 2');
      level = 2; // Upgrade to Level 2

      decisionPoints.push({
        point: 'D',
        triggered: true,
        criteria: pointDCriteria,
        notes: 'Vital signs abnormal - upgraded from ESI 3 to ESI 2',
      });

      reasoning = `ESI Level 2 assigned: Initially assessed as ESI 3 based on resource needs (${resources.totalCount} resources), ` +
        `but upgraded due to abnormal vital signs: ${vitalCheck.reasons.join('; ')}. Patient requires closer monitoring.`;

      return buildAssessment(level, decisionPoints, redFlags, resources, reasoning);
    } else {
      pointDCriteria.push('Vital signs within acceptable limits');

      decisionPoints.push({
        point: 'D',
        triggered: false,
        criteria: pointDCriteria,
        notes: 'Vital signs stable - confirmed ESI 3',
      });
    }
  }

  // Build final reasoning
  if (level === 3) {
    reasoning = `ESI Level 3 assigned: Patient is stable but likely requires multiple resources ` +
      `(${resources.totalCount} expected: ${resourceList.join(', ')}). ` +
      `Vital signs are within acceptable parameters.`;
  } else if (level === 4) {
    reasoning = `ESI Level 4 assigned: Patient requires one resource (${resourceList.join(', ')}). ` +
      `Condition is stable and does not meet high-risk criteria.`;
  } else if (level === 5) {
    reasoning = `ESI Level 5 assigned: Patient does not require emergency department resources. ` +
      `May be appropriate for fast-track or could potentially be managed in an urgent care or primary care setting.`;
  }

  return buildAssessment(level, decisionPoints, redFlags, resources, reasoning);
}

function buildAssessment(
  level: ESILevel,
  decisionPoints: DecisionPointResult[],
  redFlags: RedFlagMatch[],
  resources: ResourcePrediction,
  reasoning: string
): ESIAssessment {
  // Generate recommendations based on level
  const recommendations: string[] = [];

  switch (level) {
    case 1:
      recommendations.push(
        'Immediate resuscitation required',
        'Activate emergency response team',
        'Continuous vital sign monitoring',
        'Prepare for potential airway management',
        'Establish IV access immediately'
      );
      break;
    case 2:
      recommendations.push(
        'Bedside evaluation by physician immediately',
        'Do not leave patient unattended',
        'Continuous cardiac monitoring recommended',
        'Prepare for potential deterioration',
        'Consider early specialist consultation'
      );
      break;
    case 3:
      recommendations.push(
        'Place patient in monitored area',
        'Obtain vital signs every 30-60 minutes',
        'Initiate diagnostic workup promptly',
        'Reassess if condition changes'
      );
      break;
    case 4:
      recommendations.push(
        'Standard evaluation area appropriate',
        'Single resource pathway expected',
        'Follow up with primary care if symptoms persist'
      );
      break;
    case 5:
      recommendations.push(
        'Fast-track area appropriate if available',
        'May be suitable for urgent care referral',
        'Provide discharge instructions and return precautions'
      );
      break;
  }

  // Add specific recommendations based on red flags
  if (redFlags.some(rf => rf.category === 'psychiatric')) {
    recommendations.push('Ensure safe environment - remove potential self-harm items');
    recommendations.push('Consider 1:1 observation');
  }

  if (redFlags.some(rf => rf.category === 'cardiovascular' && rf.severity === 'high')) {
    recommendations.push('Obtain ECG within 10 minutes of arrival');
    recommendations.push('Consider aspirin if ACS suspected (if no contraindications)');
  }

  if (redFlags.some(rf => rf.category === 'neurological' && rf.severity === 'high')) {
    recommendations.push('Determine last known well time');
    recommendations.push('Consider stroke alert activation if applicable');
  }

  // Calculate confidence based on available information
  let confidence = 0.7; // Base confidence
  if (resources.totalCount > 0) confidence += 0.1;
  if (decisionPoints.some(dp => dp.triggered)) confidence += 0.1;
  if (redFlags.length > 0) confidence += 0.05;
  confidence = Math.min(confidence, 0.95); // Cap at 95%

  return {
    level,
    levelDescription: getLevelDescription(level),
    decisionPoints,
    redFlagsPresent: redFlags,
    resourcesExpected: resources,
    reasoning,
    recommendations,
    reassessmentInterval: getReassessmentInterval(level),
    confidence: Math.round(confidence * 100) / 100,
  };
}

// ============================================================================
// Utility Exports
// ============================================================================

export {
  checkRedFlags,
  predictResources,
  checkVitalSignsAbnormal,
  getLevelDescription,
  getReassessmentInterval,
};

export default assessESI;
