/**
 * HELIOS Healthcare AI Platform
 * Complete module exports
 */

// Version
export const VERSION = '1.0.0';
export const SUPPORTED_LANGUAGES = ['en', 'es', 'fr'] as const;

// Configuration
export * from './config/env.js';
export * from './config/models.js';
export * from './config/languages.js';
export * from './config/voice.js';

// Types
export * from './types/index.js';

// Voice Processing
export * from './voice/index.js';

// Safety Rules
export * from './safety/index.js';

// Knowledge System
export * from './knowledge/index.js';

// Agents
export * from './agents/index.js';

// Orchestrator
export { HeliosOrchestrator, createOrchestrator } from './orchestrator/index.js';

// Monitoring
export * from './monitoring/index.js';

// SwissBrAIn Integration
export * from './integration/swissbrain.js';

// Prompts
export * from './i18n/prompts/index.js';

// Utilities
export * from './utils/index.js';
export { logger } from './utils/logger.js';

// Initialize
import { initializeKnowledge } from './knowledge/index.js';

console.log(`HELIOS Healthcare AI Platform v${VERSION}`);
console.log(`Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}`);

// Auto-initialize knowledge
initializeKnowledge();
