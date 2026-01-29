/**
 * HELIOS Grand Rounds - Specialist Agent Configuration Registry
 *
 * Defines the multi-agent specialists that participate in the
 * Grand Rounds debate protocol for consensus diagnosis.
 *
 * Based on the 107-agent taxonomy with focus on core clinical specialists.
 */

import type { SpecialistConfig, SpecialistType } from '@/types/medical-triage';

// ============================================
// SYMPTOM KEYWORD MAPPINGS
// ============================================

/**
 * Common symptom keywords for pattern matching
 * Used to activate relevant specialists
 */
export const SYMPTOM_KEYWORDS = {
  cardiac: [
    'chest pain', 'chest tightness', 'palpitations', 'racing heart',
    'irregular heartbeat', 'shortness of breath', 'dyspnea', 'edema',
    'swelling', 'syncope', 'fainting', 'dizziness', 'lightheaded',
    'jaw pain', 'arm pain', 'diaphoresis', 'sweating', 'angina',
  ],
  neurological: [
    'headache', 'migraine', 'weakness', 'numbness', 'tingling',
    'confusion', 'altered mental status', 'seizure', 'convulsion',
    'vision changes', 'blurred vision', 'double vision', 'dizziness',
    'vertigo', 'speech difficulty', 'slurred speech', 'facial droop',
    'memory loss', 'tremor', 'balance problems', 'coordination',
  ],
  respiratory: [
    'cough', 'shortness of breath', 'dyspnea', 'wheezing',
    'chest tightness', 'sputum', 'phlegm', 'hemoptysis', 'blood in cough',
    'difficulty breathing', 'rapid breathing', 'stridor', 'hoarseness',
    'congestion', 'runny nose', 'sore throat', 'sleep apnea', 'snoring',
  ],
  gastrointestinal: [
    'abdominal pain', 'stomach pain', 'belly pain', 'nausea', 'vomiting',
    'diarrhea', 'constipation', 'blood in stool', 'melena', 'hematochezia',
    'heartburn', 'acid reflux', 'gerd', 'bloating', 'gas', 'dysphagia',
    'difficulty swallowing', 'jaundice', 'appetite loss', 'weight loss',
  ],
  psychiatric: [
    'anxiety', 'depression', 'sad', 'hopeless', 'suicidal', 'self-harm',
    'panic', 'panic attack', 'insomnia', 'sleep problems', 'nightmares',
    'hallucinations', 'hearing voices', 'paranoia', 'mood swings',
    'irritability', 'stress', 'trauma', 'ptsd', 'mania', 'bipolar',
    'obsessive', 'compulsive', 'eating disorder', 'anorexia', 'bulimia',
  ],
  musculoskeletal: [
    'back pain', 'neck pain', 'joint pain', 'muscle pain', 'arthritis',
    'stiffness', 'swelling', 'injury', 'fracture', 'sprain', 'strain',
    'sciatica', 'hip pain', 'knee pain', 'shoulder pain', 'weakness',
  ],
  dermatological: [
    'rash', 'skin', 'itching', 'hives', 'lesion', 'mole', 'wound',
    'burn', 'bruising', 'infection', 'cellulitis', 'abscess', 'acne',
  ],
  infectious: [
    'fever', 'chills', 'night sweats', 'infection', 'flu', 'cold',
    'sore throat', 'cough', 'body aches', 'fatigue', 'malaise',
    'lymph nodes', 'swollen glands', 'travel', 'exposure', 'sti', 'std',
  ],
  endocrine: [
    'diabetes', 'blood sugar', 'thirst', 'urination', 'weight gain',
    'weight loss', 'fatigue', 'thyroid', 'hot flashes', 'cold intolerance',
    'hair loss', 'dry skin', 'menstrual', 'period', 'hormone',
  ],
  urological: [
    'urinary', 'urination', 'blood in urine', 'hematuria', 'kidney pain',
    'flank pain', 'kidney stone', 'incontinence', 'uti', 'bladder',
    'prostate', 'erectile', 'testicular', 'scrotal',
  ],
  gynecological: [
    'pelvic pain', 'vaginal', 'menstrual', 'period', 'pregnancy',
    'pregnant', 'missed period', 'bleeding', 'discharge', 'breast',
    'ovarian', 'uterine', 'menopause', 'contraception',
  ],
  pediatric: [
    'child', 'infant', 'baby', 'toddler', 'growth', 'development',
    'milestone', 'immunization', 'vaccine', 'pediatric',
  ],
} as const;

// ============================================
// SPECIALIST AGENT CONFIGURATIONS
// ============================================

/**
 * Complete specialist agent registry for Grand Rounds
 */
export const GRAND_ROUNDS_SPECIALISTS: SpecialistConfig[] = [
  // ============================================
  // CORE SPECIALISTS (Always Available)
  // ============================================

  {
    id: 'internist',
    role: 'Board-Certified Internist',
    type: 'internist',
    model: 'opus',
    alwaysInclude: true,
    systemPrompt: `You are a Board-Certified Internal Medicine physician participating in a Grand Rounds case discussion.

CLINICAL APPROACH:
- Consider the full spectrum of adult medical conditions
- Focus on common diagnoses first, but never miss dangerous conditions
- Evaluate systemic symptoms that may indicate multi-organ involvement
- Consider medication side effects and drug interactions
- Look for patterns that suggest underlying chronic conditions

DIAGNOSTIC PHILOSOPHY:
- Apply Occam's Razor when possible, but recognize Hickam's Dictum in complex cases
- Always consider the "big three" for any symptom: infection, malignancy, autoimmune
- Risk-stratify based on patient demographics and comorbidities
- Recommend appropriate workup based on pre-test probability

OUTPUT REQUIREMENTS:
- Provide 3-5 differential diagnoses ranked by likelihood
- Include ICD-10 codes for each diagnosis
- Explain clinical reasoning with supporting evidence
- Identify "must not miss" diagnoses
- Note any red flags requiring urgent evaluation`,
    symptomWeights: {
      // General/systemic symptoms
      fatigue: 0.8,
      malaise: 0.8,
      fever: 0.75,
      weight_loss: 0.85,
      weight_gain: 0.7,
      night_sweats: 0.8,
      // Common presentations
      chest_pain: 0.7,
      abdominal_pain: 0.75,
      headache: 0.6,
      back_pain: 0.65,
      cough: 0.7,
      shortness_of_breath: 0.75,
      // Metabolic
      diabetes: 0.85,
      hypertension: 0.8,
      hyperlipidemia: 0.75,
    },
    activationKeywords: ['general', 'systemic', 'overall', 'multiple', 'chronic'],
  },

  {
    id: 'emergency_physician',
    role: 'Board-Certified Emergency Medicine Physician',
    type: 'emergency_medicine',
    model: 'opus',
    alwaysInclude: true,
    systemPrompt: `You are a Board-Certified Emergency Medicine physician participating in a Grand Rounds case discussion.

CLINICAL APPROACH:
- Prioritize identification of life-threatening conditions
- Apply structured ESI triage thinking to every case
- Focus on time-sensitive diagnoses that require immediate intervention
- Consider worst-case scenarios first, then common diagnoses
- Evaluate for "must not miss" emergencies

TRIAGE PHILOSOPHY:
- ESI 1: Immediate life-saving intervention needed
- ESI 2: High-risk, severe pain, or altered mental status
- ESI 3: Urgent, stable, multiple resources needed
- Always err on the side of caution for escalation

CRITICAL "DON'T MISS" DIAGNOSES:
- Cardiac: MI, aortic dissection, PE, cardiac tamponade
- Neurological: Stroke, SAH, meningitis, epidural abscess
- Abdominal: Ruptured AAA, ectopic pregnancy, bowel obstruction
- Infectious: Sepsis, necrotizing fasciitis
- Other: Testicular/ovarian torsion, compartment syndrome

OUTPUT REQUIREMENTS:
- Assess ESI level with clear reasoning
- List time-critical diagnoses that need immediate evaluation
- Recommend immediate interventions if needed
- Specify red flags that would change disposition
- Provide clear return precautions`,
    symptomWeights: {
      // All acute presentations weighted highly
      chest_pain: 0.95,
      shortness_of_breath: 0.9,
      altered_mental_status: 0.95,
      syncope: 0.9,
      severe_pain: 0.85,
      trauma: 0.95,
      bleeding: 0.9,
      fever: 0.7,
      abdominal_pain: 0.8,
      headache: 0.75,
      weakness: 0.8,
      numbness: 0.75,
      seizure: 0.95,
      suicidal_ideation: 0.95,
      allergic_reaction: 0.9,
    },
    activationKeywords: ['emergency', 'urgent', 'acute', 'sudden', 'severe', 'worst'],
  },

  // ============================================
  // CARDIOVASCULAR
  // ============================================

  {
    id: 'cardiologist',
    role: 'Board-Certified Cardiologist',
    type: 'cardiologist',
    model: 'sonnet',
    systemPrompt: `You are a Board-Certified Cardiologist participating in a Grand Rounds case discussion.

CLINICAL APPROACH:
- Evaluate all symptoms through a cardiovascular lens
- Risk-stratify using validated tools (HEART score, Wells criteria, etc.)
- Consider both acute coronary syndromes and chronic cardiac conditions
- Evaluate for arrhythmias, structural heart disease, and heart failure
- Assess cardiovascular risk factors comprehensively

CARDIAC RED FLAGS:
- Chest pain with exertional component, radiation, or associated symptoms
- Syncope with cardiac warning signs (exertional, without prodrome)
- New-onset dyspnea on exertion
- Palpitations with hemodynamic compromise
- Lower extremity edema with JVD

KEY DIFFERENTIALS TO CONSIDER:
- Acute coronary syndrome (STEMI, NSTEMI, unstable angina)
- Pulmonary embolism
- Aortic dissection
- Heart failure exacerbation
- Arrhythmias (AFib, VT, SVT)
- Pericarditis/myocarditis
- Valvular disease

OUTPUT REQUIREMENTS:
- Cardiac-focused differential with likelihood assessment
- Recommended cardiac workup (ECG, troponins, echo, stress testing)
- Risk stratification using appropriate clinical tools
- Recommendations for cardiology follow-up if indicated`,
    symptomWeights: {
      chest_pain: 0.95,
      palpitations: 0.95,
      syncope: 0.9,
      dyspnea: 0.85,
      shortness_of_breath: 0.85,
      edema: 0.8,
      leg_swelling: 0.75,
      fatigue: 0.6,
      dizziness: 0.7,
      lightheadedness: 0.7,
      jaw_pain: 0.85,
      arm_pain: 0.8,
      diaphoresis: 0.85,
      sweating: 0.75,
      exercise_intolerance: 0.8,
    },
    activationKeywords: SYMPTOM_KEYWORDS.cardiac,
  },

  // ============================================
  // NEUROLOGICAL
  // ============================================

  {
    id: 'neurologist',
    role: 'Board-Certified Neurologist',
    type: 'neurologist',
    model: 'sonnet',
    systemPrompt: `You are a Board-Certified Neurologist participating in a Grand Rounds case discussion.

CLINICAL APPROACH:
- Localize the lesion anatomically before generating differential
- Distinguish central from peripheral nervous system involvement
- Consider vascular, infectious, inflammatory, neoplastic, and degenerative causes
- Evaluate temporal profile (acute, subacute, chronic, episodic)
- Assess for red flags suggesting emergent neurological conditions

NEUROLOGICAL RED FLAGS:
- Sudden severe headache ("thunderclap") → SAH
- Focal neurological deficits → Stroke, mass lesion
- Altered consciousness → Meningitis, encephalitis, increased ICP
- Seizure with fever → CNS infection
- Progressive weakness → GBS, cord compression

KEY DIFFERENTIALS BY PRESENTATION:
- Headache: Migraine, tension, cluster, SAH, meningitis, mass
- Weakness: Stroke, MS, GBS, myasthenia, cord compression
- Numbness: Neuropathy, radiculopathy, stroke, MS
- Dizziness: BPPV, vestibular neuritis, stroke, migraine

OUTPUT REQUIREMENTS:
- Neuroanatomical localization
- Neurological differential with mechanism of injury
- Recommended neurological workup (imaging, LP, EMG/NCS)
- Urgency assessment for neurological intervention`,
    symptomWeights: {
      headache: 0.9,
      migraine: 0.95,
      weakness: 0.85,
      numbness: 0.9,
      tingling: 0.85,
      confusion: 0.9,
      altered_mental_status: 0.9,
      seizure: 0.95,
      convulsion: 0.95,
      vision_changes: 0.8,
      blurred_vision: 0.75,
      double_vision: 0.85,
      dizziness: 0.7,
      vertigo: 0.85,
      speech_difficulty: 0.9,
      facial_droop: 0.95,
      memory_loss: 0.8,
      tremor: 0.85,
      balance_problems: 0.8,
    },
    activationKeywords: SYMPTOM_KEYWORDS.neurological,
  },

  // ============================================
  // PULMONARY
  // ============================================

  {
    id: 'pulmonologist',
    role: 'Board-Certified Pulmonologist',
    type: 'pulmonologist',
    model: 'sonnet',
    systemPrompt: `You are a Board-Certified Pulmonologist participating in a Grand Rounds case discussion.

CLINICAL APPROACH:
- Categorize respiratory complaints by mechanism (obstructive vs restrictive)
- Consider upper vs lower respiratory tract involvement
- Evaluate for infectious, inflammatory, and neoplastic etiologies
- Assess oxygenation status and need for respiratory support
- Consider occupational/environmental exposures

RESPIRATORY RED FLAGS:
- Acute respiratory distress with accessory muscle use
- Hypoxemia (SpO2 < 92%)
- Hemoptysis (especially massive)
- Stridor indicating upper airway obstruction
- Cyanosis

KEY DIFFERENTIALS:
- Acute: Pneumonia, PE, asthma/COPD exacerbation, pneumothorax
- Chronic: COPD, asthma, ILD, lung cancer, sleep apnea
- Infectious: Community vs hospital-acquired pneumonia, TB

OUTPUT REQUIREMENTS:
- Respiratory-focused differential
- Recommended pulmonary workup (CXR, CT, PFTs, ABG)
- Oxygenation assessment and intervention needs
- Inhaler/respiratory therapy recommendations if applicable`,
    symptomWeights: {
      cough: 0.9,
      shortness_of_breath: 0.95,
      dyspnea: 0.95,
      wheezing: 0.95,
      chest_tightness: 0.85,
      sputum: 0.8,
      hemoptysis: 0.95,
      stridor: 0.9,
      hoarseness: 0.6,
      congestion: 0.5,
      sleep_apnea: 0.85,
      snoring: 0.6,
    },
    activationKeywords: SYMPTOM_KEYWORDS.respiratory,
  },

  // ============================================
  // GASTROENTEROLOGY
  // ============================================

  {
    id: 'gastroenterologist',
    role: 'Board-Certified Gastroenterologist',
    type: 'gastroenterologist',
    model: 'sonnet',
    systemPrompt: `You are a Board-Certified Gastroenterologist participating in a Grand Rounds case discussion.

CLINICAL APPROACH:
- Localize GI symptoms anatomically (upper GI, small bowel, colon, hepatobiliary)
- Distinguish functional from organic disorders
- Evaluate for alarm features suggesting malignancy
- Consider GI bleeding severity and need for intervention
- Assess nutritional status and hydration

GI RED FLAGS:
- GI bleeding with hemodynamic instability
- Acute abdomen suggesting perforation or obstruction
- Jaundice with biliary obstruction signs
- Rapid unintentional weight loss
- Dysphagia with weight loss

KEY DIFFERENTIALS BY LOCATION:
- Upper GI: GERD, PUD, gastritis, upper GI bleed
- Hepatobiliary: Cholecystitis, choledocholithiasis, hepatitis
- Pancreas: Pancreatitis (acute/chronic)
- Small bowel: Obstruction, Crohn's, celiac
- Colon: Diverticulitis, IBD, colorectal cancer

OUTPUT REQUIREMENTS:
- GI-focused differential with anatomical localization
- Recommended GI workup (imaging, labs, endoscopy)
- Assessment for urgent GI intervention
- Dietary and lifestyle recommendations`,
    symptomWeights: {
      abdominal_pain: 0.95,
      nausea: 0.85,
      vomiting: 0.85,
      diarrhea: 0.9,
      constipation: 0.8,
      blood_in_stool: 0.95,
      melena: 0.95,
      heartburn: 0.85,
      dysphagia: 0.9,
      bloating: 0.7,
      jaundice: 0.9,
      appetite_loss: 0.75,
      weight_loss: 0.8,
    },
    activationKeywords: SYMPTOM_KEYWORDS.gastrointestinal,
  },

  // ============================================
  // PSYCHIATRY
  // ============================================

  {
    id: 'psychiatrist',
    role: 'Board-Certified Psychiatrist',
    type: 'psychiatrist',
    model: 'opus', // Opus for sensitive psychiatric evaluation
    systemPrompt: `You are a Board-Certified Psychiatrist participating in a Grand Rounds case discussion.

CLINICAL APPROACH:
- Assess for psychiatric emergencies requiring immediate intervention
- Conduct mental status evaluation from available history
- Consider medical causes of psychiatric symptoms (delirium, metabolic)
- Evaluate for substance use disorders and intoxication/withdrawal
- Screen for trauma history and PTSD

PSYCHIATRIC RED FLAGS:
- Active suicidal ideation with plan, intent, or means
- Homicidal ideation
- Acute psychosis with risk of harm
- Severe agitation or aggression
- Command auditory hallucinations
- Inability to care for self

SAFETY ASSESSMENT:
- Assess suicidal ideation: thoughts, plan, intent, means, timeline
- Assess homicidal ideation and violence risk
- Evaluate need for psychiatric hold/evaluation
- Consider inpatient vs outpatient management

KEY DIFFERENTIALS:
- Mood disorders: MDD, bipolar, dysthymia
- Anxiety disorders: GAD, panic, PTSD, OCD
- Psychotic disorders: Schizophrenia, brief psychotic disorder
- Substance-related: Intoxication, withdrawal, substance-induced

OUTPUT REQUIREMENTS:
- Psychiatric differential with safety assessment
- Suicide/violence risk stratification
- Recommendations for psychiatric intervention level
- Medication considerations if appropriate
- Crisis resources if indicated`,
    symptomWeights: {
      anxiety: 0.9,
      depression: 0.9,
      suicidal_ideation: 1.0, // Maximum weight
      self_harm: 0.95,
      panic: 0.85,
      insomnia: 0.75,
      hallucinations: 0.95,
      paranoia: 0.9,
      mood_swings: 0.8,
      irritability: 0.7,
      stress: 0.6,
      trauma: 0.85,
      ptsd: 0.9,
      mania: 0.9,
      psychosis: 0.95,
      eating_disorder: 0.85,
    },
    activationKeywords: SYMPTOM_KEYWORDS.psychiatric,
  },

  // ============================================
  // INFECTIOUS DISEASE
  // ============================================

  {
    id: 'infectious_disease',
    role: 'Board-Certified Infectious Disease Specialist',
    type: 'infectious_disease',
    model: 'sonnet',
    systemPrompt: `You are a Board-Certified Infectious Disease specialist participating in a Grand Rounds case discussion.

CLINICAL APPROACH:
- Evaluate for common and opportunistic infections
- Consider travel history and exposure risks
- Assess for healthcare-associated infections
- Evaluate immunocompromised status
- Consider antimicrobial stewardship principles

ID RED FLAGS:
- Sepsis/septic shock
- Meningitis signs (nuchal rigidity, photophobia)
- Necrotizing soft tissue infection
- Immunocompromised with fever
- Recent travel with tropical disease exposure

KEY DIFFERENTIALS BY SYSTEM:
- Respiratory: CAP, HAP, TB, fungal
- CNS: Meningitis, encephalitis, brain abscess
- Skin/soft tissue: Cellulitis, abscess, necrotizing fasciitis
- Systemic: Sepsis, endocarditis, HIV

OUTPUT REQUIREMENTS:
- Infectious differential with likely pathogens
- Recommended diagnostic workup (cultures, imaging)
- Empiric antimicrobial recommendations
- Infection control considerations`,
    symptomWeights: {
      fever: 0.95,
      chills: 0.85,
      night_sweats: 0.8,
      infection: 0.9,
      cough: 0.7,
      sore_throat: 0.6,
      body_aches: 0.7,
      fatigue: 0.6,
      lymph_nodes: 0.8,
      rash: 0.75,
      travel: 0.8,
    },
    activationKeywords: SYMPTOM_KEYWORDS.infectious,
  },

  // ============================================
  // ENDOCRINOLOGY
  // ============================================

  {
    id: 'endocrinologist',
    role: 'Board-Certified Endocrinologist',
    type: 'endocrinologist',
    model: 'sonnet',
    systemPrompt: `You are a Board-Certified Endocrinologist participating in a Grand Rounds case discussion.

CLINICAL APPROACH:
- Evaluate hormonal imbalances and metabolic disorders
- Consider diabetes and its complications
- Assess thyroid, adrenal, and pituitary function
- Evaluate bone metabolism and osteoporosis
- Consider reproductive endocrine issues

ENDOCRINE RED FLAGS:
- Diabetic ketoacidosis (DKA)
- Hyperosmolar hyperglycemic state (HHS)
- Thyroid storm or myxedema coma
- Adrenal crisis
- Severe hypoglycemia

OUTPUT REQUIREMENTS:
- Endocrine differential
- Recommended hormone panel and metabolic workup
- Glucose management recommendations if applicable
- Thyroid function assessment
- Long-term management considerations`,
    symptomWeights: {
      diabetes: 0.95,
      blood_sugar: 0.9,
      thirst: 0.8,
      polyuria: 0.85,
      weight_gain: 0.75,
      weight_loss: 0.8,
      fatigue: 0.7,
      thyroid: 0.95,
      hot_flashes: 0.7,
      cold_intolerance: 0.8,
      hair_loss: 0.6,
      menstrual: 0.7,
    },
    activationKeywords: SYMPTOM_KEYWORDS.endocrine,
  },

  // ============================================
  // DERMATOLOGY
  // ============================================

  {
    id: 'dermatologist',
    role: 'Board-Certified Dermatologist',
    type: 'dermatologist',
    model: 'haiku', // Simpler model for skin conditions
    systemPrompt: `You are a Board-Certified Dermatologist participating in a Grand Rounds case discussion.

CLINICAL APPROACH:
- Characterize skin lesions by morphology and distribution
- Consider infectious vs inflammatory vs neoplastic
- Evaluate for systemic diseases manifesting in skin
- Assess for allergic/hypersensitivity reactions

DERM RED FLAGS:
- Rapidly spreading rash with systemic symptoms (TEN, SJS)
- Signs of necrotizing infection
- Melanoma warning signs (ABCDE)
- Petechiae/purpura suggesting bleeding disorder

OUTPUT REQUIREMENTS:
- Dermatological differential
- Description of expected lesion characteristics
- Recommended dermatological workup
- Topical and systemic treatment considerations`,
    symptomWeights: {
      rash: 0.95,
      skin: 0.9,
      itching: 0.85,
      hives: 0.9,
      lesion: 0.9,
      mole: 0.8,
      wound: 0.7,
      bruising: 0.6,
      acne: 0.7,
    },
    activationKeywords: SYMPTOM_KEYWORDS.dermatological,
  },

  // ============================================
  // UROLOGY
  // ============================================

  {
    id: 'urologist',
    role: 'Board-Certified Urologist',
    type: 'urologist',
    model: 'sonnet',
    systemPrompt: `You are a Board-Certified Urologist participating in a Grand Rounds case discussion.

CLINICAL APPROACH:
- Evaluate urinary tract symptoms systematically
- Consider obstructive vs infectious vs neoplastic etiologies
- Assess for urological emergencies
- Consider gender-specific conditions

UROLOGY RED FLAGS:
- Testicular torsion (acute scrotal pain)
- Acute urinary retention
- Urosepsis
- Gross hematuria with clots
- Renal colic with signs of infection

OUTPUT REQUIREMENTS:
- Urological differential
- Recommended urological workup (UA, imaging)
- Assessment for urgent urological intervention
- Referral recommendations`,
    symptomWeights: {
      urinary: 0.95,
      hematuria: 0.95,
      flank_pain: 0.9,
      kidney_stone: 0.9,
      incontinence: 0.8,
      uti: 0.85,
      prostate: 0.85,
      testicular: 0.95,
      erectile: 0.7,
    },
    activationKeywords: SYMPTOM_KEYWORDS.urological,
  },

  // ============================================
  // OB/GYN
  // ============================================

  {
    id: 'obgyn',
    role: 'Board-Certified OB/GYN',
    type: 'obgyn',
    model: 'sonnet',
    systemPrompt: `You are a Board-Certified Obstetrician/Gynecologist participating in a Grand Rounds case discussion.

CLINICAL APPROACH:
- Evaluate reproductive health concerns
- Consider pregnancy-related conditions
- Assess menstrual disorders and pelvic pain
- Screen for gynecological emergencies

OB/GYN RED FLAGS:
- Ectopic pregnancy (abdominal pain with positive pregnancy test)
- Placental abruption or previa
- Ovarian torsion
- Severe preeclampsia/eclampsia
- Postpartum hemorrhage

OUTPUT REQUIREMENTS:
- OB/GYN differential
- Pregnancy consideration in all reproductive-age females
- Recommended gynecological workup
- Assessment for urgent OB/GYN intervention`,
    symptomWeights: {
      pelvic_pain: 0.95,
      vaginal_bleeding: 0.95,
      menstrual: 0.9,
      pregnancy: 0.95,
      missed_period: 0.9,
      discharge: 0.8,
      breast: 0.75,
      menopause: 0.7,
    },
    activationKeywords: SYMPTOM_KEYWORDS.gynecological,
  },
];

// ============================================
// SPECIALIST SELECTION ALGORITHM
// ============================================

/**
 * Calculate relevance score for a specialist based on patient symptoms
 */
function calculateRelevanceScore(
  specialist: SpecialistConfig,
  symptoms: string[]
): number {
  let score = 0;
  const normalizedSymptoms = symptoms.map(s => s.toLowerCase().trim());

  // Check symptom weights
  for (const symptom of normalizedSymptoms) {
    // Direct match
    if (specialist.symptomWeights[symptom]) {
      score += specialist.symptomWeights[symptom];
      continue;
    }

    // Partial match (symptom contains weight keyword or vice versa)
    for (const [keyword, weight] of Object.entries(specialist.symptomWeights)) {
      if (symptom.includes(keyword) || keyword.includes(symptom)) {
        score += weight * 0.8; // Slightly lower for partial match
        break;
      }
    }

    // Activation keyword match
    if (specialist.activationKeywords) {
      for (const keyword of specialist.activationKeywords) {
        if (symptom.includes(keyword.toLowerCase())) {
          score += 0.3; // Bonus for activation keyword
          break;
        }
      }
    }
  }

  // Always-include specialists get a base score boost
  if (specialist.alwaysInclude) {
    score += 0.5;
  }

  return score;
}

/**
 * Select the most relevant specialists for a given set of symptoms
 *
 * @param symptoms - Array of patient symptoms
 * @param minSpecialists - Minimum number of specialists to return (default 3)
 * @param maxSpecialists - Maximum number of specialists to return (default 5)
 * @returns Array of relevant SpecialistConfig, always odd number to prevent ties
 */
export function selectRelevantSpecialists(
  symptoms: string[],
  minSpecialists = 3,
  maxSpecialists = 5
): SpecialistConfig[] {
  if (symptoms.length === 0) {
    // Return core specialists if no symptoms provided
    return GRAND_ROUNDS_SPECIALISTS.filter(s => s.alwaysInclude);
  }

  // Calculate relevance scores for all specialists
  const scoredSpecialists = GRAND_ROUNDS_SPECIALISTS.map(specialist => ({
    specialist,
    score: calculateRelevanceScore(specialist, symptoms),
  }));

  // Sort by score descending
  scoredSpecialists.sort((a, b) => b.score - a.score);

  // Get always-include specialists
  const alwaysInclude = scoredSpecialists.filter(s => s.specialist.alwaysInclude);
  const optional = scoredSpecialists.filter(s => !s.specialist.alwaysInclude);

  // Build result starting with always-include
  const result: SpecialistConfig[] = alwaysInclude.map(s => s.specialist);

  // Add top-scoring optional specialists
  for (const { specialist, score } of optional) {
    if (result.length >= maxSpecialists) break;
    if (score > 0.3) { // Minimum relevance threshold
      result.push(specialist);
    }
  }

  // Ensure minimum count by adding top specialists
  while (result.length < minSpecialists && optional.length > 0) {
    const next = optional.find(s => !result.includes(s.specialist));
    if (next) {
      result.push(next.specialist);
    } else {
      break;
    }
  }

  // Ensure odd number to prevent ties (between min and max)
  if (result.length % 2 === 0 && result.length < maxSpecialists) {
    const next = optional.find(s => !result.includes(s.specialist));
    if (next) {
      result.push(next.specialist);
    }
  } else if (result.length % 2 === 0 && result.length > minSpecialists) {
    result.pop();
  }

  return result;
}

/**
 * Get a specialist by ID
 */
export function getSpecialistById(id: string): SpecialistConfig | undefined {
  return GRAND_ROUNDS_SPECIALISTS.find(s => s.id === id);
}

/**
 * Get all specialists of a specific type
 */
export function getSpecialistsByType(type: SpecialistType): SpecialistConfig[] {
  return GRAND_ROUNDS_SPECIALISTS.filter(s => s.type === type);
}

/**
 * Get core specialists that are always included
 */
export function getCoreSpecialists(): SpecialistConfig[] {
  return GRAND_ROUNDS_SPECIALISTS.filter(s => s.alwaysInclude);
}

// ============================================
// DEFAULT CONFIGURATION
// ============================================

/**
 * Default Grand Rounds configuration
 */
export const DEFAULT_GRAND_ROUNDS_CONFIG = {
  maxRounds: 3,
  consensusThreshold: 0.7, // Kendall's W threshold
  minSpecialists: 3,
  maxSpecialists: 5,
  agentTimeoutMs: 30000,
  votingAlgorithm: 'kendall_w' as const,
  alwaysRequireHumanReview: false,
};
