/**
 * HELIOS Safety Module
 * Deterministic safety checking without LLM dependency
 */

export {
  SAFETY_RULES,
  checkSafetyRules,
  getEmergencyNumber,
  type SafetyRule,
  type PatientState,
  type SafetyCheckResult,
} from './rules.js';
