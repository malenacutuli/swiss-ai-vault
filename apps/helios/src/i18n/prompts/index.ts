/**
 * HELIOS Multi-Language Prompt System
 * Unified access to EN/ES/FR prompts
 */

import { ENGLISH_PROMPTS } from './en.js';
import { SPANISH_PROMPTS } from './es.js';
import { FRENCH_PROMPTS } from './fr.js';
import type { SupportedLanguage } from '../../config/languages.js';

// All prompts by language
const PROMPTS = {
  en: ENGLISH_PROMPTS,
  es: SPANISH_PROMPTS,
  fr: FRENCH_PROMPTS,
} as const;

// Prompt keys (same across all languages)
export type PromptKey = keyof typeof ENGLISH_PROMPTS;

/**
 * Get a prompt in the specified language
 */
export function getPrompt(key: PromptKey, language: SupportedLanguage): string {
  const languagePrompts = PROMPTS[language];
  return languagePrompts[key] || PROMPTS.en[key];
}

/**
 * Get the orchestrator prompt for a language
 */
export function getOrchestratorPrompt(language: SupportedLanguage): string {
  return getPrompt('orchestrator', language);
}

/**
 * Get triage agent prompt
 */
export function getTriagePrompt(language: SupportedLanguage): string {
  return getPrompt('triage', language);
}

/**
 * Get history taking prompt
 */
export function getHistoryPrompt(language: SupportedLanguage): string {
  return getPrompt('history', language);
}

/**
 * Get safety gate prompt
 */
export function getSafetyGatePrompt(language: SupportedLanguage): string {
  return getPrompt('safety_gate', language);
}

/**
 * Get greeting message
 */
export function getGreeting(language: SupportedLanguage): string {
  return getPrompt('greeting', language);
}

/**
 * Get emergency message by type
 */
export function getEmergencyMessage(
  type: 'chest_pain' | 'stroke' | 'suicide' | 'infant_fever',
  language: SupportedLanguage
): string {
  const key = `emergency_${type}` as PromptKey;
  return getPrompt(key, language);
}

// Export individual language prompts for direct access
export { ENGLISH_PROMPTS } from './en.js';
export { SPANISH_PROMPTS } from './es.js';
export { FRENCH_PROMPTS } from './fr.js';
