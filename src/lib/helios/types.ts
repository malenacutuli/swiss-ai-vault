/**
 * HELIOS Frontend Types
 * Shared types for React components
 */

export type SupportedLanguage = 'en' | 'es' | 'fr' | 'de' | 'pt' | 'it' | 'ca';

export type Phase =
  | 'intake'
  | 'chief_complaint'
  | 'history_taking'
  | 'triage'
  | 'differential'
  | 'plan'
  | 'safety_gate'
  | 'booking'
  | 'documentation'
  | 'completed'
  | 'escalated';

export type TriageLevel = 'ESI1' | 'ESI2' | 'ESI3' | 'ESI4' | 'ESI5';

export type Disposition =
  | 'emergency'
  | 'urgent_care'
  | 'primary_care'
  | 'specialist'
  | 'telehealth'
  | 'self_care';

export type Severity = 'critical' | 'high' | 'moderate' | 'low';

export interface MessageAttachment {
  type: 'image' | 'document';
  filename: string;
  url?: string;
}

export interface MessageButton {
  label: string;
  value: string;
  variant?: 'default' | 'primary' | 'outline';
}

export interface Message {
  id?: string;
  message_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  language: SupportedLanguage;
  emotion?: EmotionAnalysis;
  timestamp: string;
  attachments?: MessageAttachment[];
  redFlags?: RedFlag[];
  buttons?: MessageButton[];
  inputType?: 'text' | 'file' | 'date';
  inputPlaceholder?: string;
}

export interface RedFlag {
  flag_id: string;
  rule_id: string;
  flag_type: string;
  description: string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  escalation_level: 'emergency' | 'urgent' | 'flag_only';
  action_taken: string;
  detected_at: string;
  emergency_number?: string;
}

export interface EmotionAnalysis {
  timestamp: string;
  emotions: Record<string, number>;
  dominant_emotion: string;
  dominant_score: number;
  distress_level: number;
  pain_indicators: number;
  urgency_boost: number;
  requires_escalation: boolean;
}

export interface SessionResponse {
  session_id: string;
  phase: Phase;
  message: string;
  language: SupportedLanguage;
  red_flags?: RedFlag[];
  emotion?: EmotionAnalysis;
  escalated?: boolean;
}

export interface TriageResult {
  triage_level: TriageLevel;
  disposition: Disposition;
  urgency: 'immediate' | 'within_24h' | 'within_week' | 'routine';
  rationale: string;
  warning_signs: string[];
  confidence: number;
}

// Clinical Types for SOAP Notes and Case Management

export interface SymptomEntity {
  symptom_id: string;
  name: string;
  present: boolean;
  duration?: string;
  severity?: 'mild' | 'moderate' | 'severe';
  location?: string;
  character?: string;
  onset?: string;
  aggravating_factors?: string[];
  relieving_factors?: string[];
}

export interface Hypothesis {
  hypothesis_id: string;
  name: string;
  confidence: number;
  icd_code?: string;
  supporting_evidence?: string[];
  against_evidence?: string[];
  requires_workup?: string[];
}

export interface Medication {
  name: string;
  dosage?: string;
  frequency?: string;
  reason?: string;
  start_date?: string;
}

export interface MedicalHistory {
  conditions: string[];
  surgeries?: string[];
  family_history?: string[];
  social_history?: string;
  immunizations?: string[];
}

export interface Demographics {
  age: number;
  sex: string;
  preferred_language?: SupportedLanguage;
}

export interface CaseState {
  session_id: string;
  phase: Phase;
  chief_complaint?: string;
  demographics?: Demographics;
  symptom_entities: SymptomEntity[];
  hypothesis_list: Hypothesis[];
  red_flags: RedFlag[];
  triage_level?: TriageLevel;
  disposition?: Disposition;
  medications?: Medication[];
  allergies?: string[];
  medical_history?: MedicalHistory;
  messages: Message[];
  created_at: string;
  updated_at: string;
}
