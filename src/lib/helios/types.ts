/**
 * HELIOS Frontend Types
 * Shared types for React components
 */

export type SupportedLanguage = 'en' | 'es' | 'fr';

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

export interface Message {
  message_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  language: SupportedLanguage;
  emotion?: EmotionAnalysis;
  timestamp: string;
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
