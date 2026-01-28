import type { SupportedLanguage } from './languages.js';

// Deepgram Configuration - Medical Speech-to-Text
export const DEEPGRAM_CONFIG = {
  model: 'nova-2-medical',
  version: 'latest',
  features: {
    punctuate: true,
    profanity_filter: false, // Medical terms may be flagged incorrectly
    redact: false, // We handle PHI separately
    diarize: true, // Speaker identification
    smart_format: true,
    utterances: true,
    paragraphs: true,
    detect_language: true,
    filler_words: false,
    sentiment: false, // Hume handles emotional analysis
  },
  // Language-specific settings
  languages: {
    en: 'en-US',
    es: 'es',
    fr: 'fr',
  } as const satisfies Record<SupportedLanguage, string>,
  // Medical vocabulary boost
  keywords: [
    'symptom:2',
    'diagnosis:2',
    'medication:2',
    'allergy:2',
    'chronic:1.5',
    'acute:1.5',
    'pain:1.5',
    'breathing:1.5',
    'chest:1.5',
    'heart:1.5',
    'stroke:2',
    'diabetes:1.5',
    'hypertension:1.5',
    'prescription:1.5',
  ],
} as const;

// Hume Configuration - Emotion Detection
export const HUME_CONFIG = {
  models: {
    prosody: true, // Voice tone analysis
    language: true, // Linguistic emotion markers
    facialExpression: false, // Not using video
  },
  // Emotion detection thresholds (0-1 scale)
  thresholds: {
    // High-priority emotions requiring immediate attention
    distress: 0.7,
    pain: 0.65,
    fear: 0.7,
    confusion: 0.6,
    anger: 0.75,
    // Moderate concern
    anxiety: 0.55,
    sadness: 0.5,
    // Positive indicators
    calmness: 0.6,
    relief: 0.5,
  },
  // Streaming configuration
  streaming: {
    chunkDurationMs: 500,
    overlapMs: 100,
    minConfidence: 0.4,
  },
} as const;

// Emotion-based triage escalation rules
export interface EmotionTriageRule {
  emotion: string;
  threshold: number;
  duration: number; // seconds of sustained emotion
  action: 'escalate' | 'flag' | 'monitor';
  priority: 'critical' | 'high' | 'medium' | 'low';
  message: string;
}

export const EMOTION_TRIAGE_RULES: EmotionTriageRule[] = [
  // Critical escalations
  {
    emotion: 'distress',
    threshold: 0.85,
    duration: 5,
    action: 'escalate',
    priority: 'critical',
    message: 'Patient showing severe distress - immediate attention required',
  },
  {
    emotion: 'pain',
    threshold: 0.8,
    duration: 10,
    action: 'escalate',
    priority: 'critical',
    message: 'Patient expressing significant pain - assess severity',
  },
  // High priority flags
  {
    emotion: 'fear',
    threshold: 0.75,
    duration: 15,
    action: 'flag',
    priority: 'high',
    message: 'Patient showing sustained fear response',
  },
  {
    emotion: 'confusion',
    threshold: 0.7,
    duration: 20,
    action: 'flag',
    priority: 'high',
    message: 'Patient showing confusion - possible cognitive concern',
  },
  {
    emotion: 'anger',
    threshold: 0.8,
    duration: 10,
    action: 'flag',
    priority: 'high',
    message: 'Patient expressing anger - de-escalation may be needed',
  },
  // Medium priority monitoring
  {
    emotion: 'anxiety',
    threshold: 0.65,
    duration: 30,
    action: 'monitor',
    priority: 'medium',
    message: 'Elevated anxiety detected',
  },
  {
    emotion: 'sadness',
    threshold: 0.6,
    duration: 60,
    action: 'monitor',
    priority: 'medium',
    message: 'Sustained sadness - mental health screening may be appropriate',
  },
];

// Combined voice processing configuration
export const VOICE_CONFIG = {
  // Audio format settings
  audio: {
    sampleRate: 16000,
    channels: 1, // Mono for medical clarity
    encoding: 'linear16' as const,
    container: 'wav' as const,
  },
  // Timeout settings
  timeouts: {
    silenceThresholdMs: 2000, // Pause detection
    maxUtteranceDurationMs: 60000, // 1 minute max per utterance
    connectionTimeoutMs: 10000,
    responseTimeoutMs: 30000,
  },
  // Retry configuration
  retry: {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
  },
  // Processing modes
  modes: {
    realtime: {
      deepgram: true,
      hume: true,
      interimResults: true,
    },
    batch: {
      deepgram: true,
      hume: true,
      interimResults: false,
    },
  },
} as const;

// Voice session state
export type VoiceSessionState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'paused'
  | 'error'
  | 'disconnected';

export interface VoiceSessionConfig {
  language: SupportedLanguage;
  mode: 'realtime' | 'batch';
  enableEmotionDetection: boolean;
  enableMedicalVocabulary: boolean;
}

export function getDeepgramLanguage(lang: SupportedLanguage): string {
  return DEEPGRAM_CONFIG.languages[lang];
}

export function getEmotionThreshold(emotion: keyof typeof HUME_CONFIG.thresholds): number {
  return HUME_CONFIG.thresholds[emotion];
}

export function getTriageRulesForPriority(priority: EmotionTriageRule['priority']): EmotionTriageRule[] {
  return EMOTION_TRIAGE_RULES.filter(rule => rule.priority === priority);
}
