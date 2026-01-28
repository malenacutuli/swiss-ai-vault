import { z } from 'zod';

export type { SupportedLanguage } from '../config/languages.js';

// Enums
export const PhaseSchema = z.enum([
  'intake', 'identity_verification', 'chief_complaint', 'history_taking',
  'triage', 'differential', 'plan', 'safety_gate', 'booking',
  'documentation', 'completed', 'escalated', 'abandoned',
]);
export type Phase = z.infer<typeof PhaseSchema>;

export const TriageLevelSchema = z.enum(['ESI1', 'ESI2', 'ESI3', 'ESI4', 'ESI5']);
export type TriageLevel = z.infer<typeof TriageLevelSchema>;

export const DispositionSchema = z.enum([
  'emergency', 'urgent_care', 'primary_care', 'specialist', 'telehealth', 'self_care',
]);
export type Disposition = z.infer<typeof DispositionSchema>;

export const SeveritySchema = z.enum(['critical', 'high', 'moderate', 'low']);
export type Severity = z.infer<typeof SeveritySchema>;

// Symptom
export const SymptomEntitySchema = z.object({
  symptom: z.string(),
  snomed_code: z.string().optional(),
  onset: z.string().optional(),
  location: z.string().optional(),
  character: z.string().optional(),
  severity: z.number().min(0).max(10).optional(),
  confidence: z.number().min(0).max(1).default(0.8),
  extracted_at: z.string().datetime(),
});
export type SymptomEntity = z.infer<typeof SymptomEntitySchema>;

// Patient Demographics
export const PatientDemographicsSchema = z.object({
  age: z.number().optional(),
  age_unit: z.enum(['years', 'months', 'days']).optional(),
  sex: z.enum(['male', 'female', 'other']).optional(),
  pregnant: z.boolean().optional(),
});
export type PatientDemographics = z.infer<typeof PatientDemographicsSchema>;

// Medication
export const MedicationSchema = z.object({
  name: z.string(),
  dose: z.string().optional(),
  frequency: z.string().optional(),
  route: z.string().optional(),
});
export type Medication = z.infer<typeof MedicationSchema>;

// Allergy
export const AllergySchema = z.object({
  allergen: z.string(),
  reaction: z.string().optional(),
  severity: z.enum(['mild', 'moderate', 'severe']).optional(),
});
export type Allergy = z.infer<typeof AllergySchema>;

// Hypothesis
export const HypothesisSchema = z.object({
  hypothesis_id: z.string().uuid(),
  diagnosis: z.string(),
  icd10_code: z.string().optional(),
  likelihood: z.number().min(0).max(1),
  category: z.enum(['must_not_miss', 'common', 'uncommon', 'rare']),
  supporting_evidence: z.array(z.string()),
  contradicting_evidence: z.array(z.string()).optional(),
  proposed_by: z.string(),
  status: z.enum(['active', 'ruled_out', 'confirmed']).default('active'),
  created_at: z.string().datetime().optional(),
});
export type Hypothesis = z.infer<typeof HypothesisSchema>;

// Red Flag
export const RedFlagSchema = z.object({
  flag_id: z.string(),
  rule_id: z.string(),
  flag_type: z.string(),
  description: z.string(),
  severity: SeveritySchema,
  escalation_level: z.enum(['emergency', 'urgent', 'flag_only']),
  action_taken: z.string(),
  detected_at: z.string().datetime(),
});
export type RedFlag = z.infer<typeof RedFlagSchema>;

// Emotion Analysis
export const EmotionAnalysisSchema = z.object({
  timestamp: z.string().datetime(),
  emotions: z.record(z.string(), z.number()),
  dominant_emotion: z.string(),
  dominant_score: z.number(),
  distress_level: z.number(),
  pain_indicators: z.number(),
  urgency_boost: z.number().default(0),
  requires_escalation: z.boolean().default(false),
});
export type EmotionAnalysis = z.infer<typeof EmotionAnalysisSchema>;

// Message
export const MessageSchema = z.object({
  message_id: z.string().uuid(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  language: z.enum(['en', 'es', 'fr']),
  emotion: EmotionAnalysisSchema.optional(),
  timestamp: z.string().datetime(),
});
export type Message = z.infer<typeof MessageSchema>;

// Case State
export const CaseStateSchema = z.object({
  session_id: z.string().uuid(),
  patient_id: z.string().uuid().optional(),
  tenant_id: z.string().uuid().optional(),
  language: z.enum(['en', 'es', 'fr']),
  current_phase: PhaseSchema,
  phase_history: z.array(z.object({
    from_phase: PhaseSchema,
    to_phase: PhaseSchema,
    timestamp: z.string().datetime(),
  })),
  // Patient info
  patient_demographics: PatientDemographicsSchema.optional(),
  chief_complaint: z.string().nullable(),
  symptom_entities: z.array(SymptomEntitySchema),
  medical_history: z.array(z.string()).optional(),
  medications: z.array(MedicationSchema).optional(),
  allergies: z.array(AllergySchema).optional(),
  // Clinical assessment
  hypothesis_list: z.array(HypothesisSchema),
  red_flags: z.array(RedFlagSchema),
  escalation_triggered: z.boolean(),
  escalation_reason: z.string().nullable(),
  triage_level: TriageLevelSchema.nullable(),
  disposition: DispositionSchema.nullable(),
  // Conversation
  messages: z.array(MessageSchema),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type CaseState = z.infer<typeof CaseStateSchema>;

// API Response
export interface SessionResponse {
  session_id: string;
  phase: Phase;
  message: string;
  language: string;
  red_flags?: RedFlag[];
  emotion?: EmotionAnalysis;
}
