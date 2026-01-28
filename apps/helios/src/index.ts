/**
 * HELIOS Healthcare AI Platform
 * Main entry point and exports
 */

// Configuration
export * from './config/env.js';
export * from './config/models.js';
export * from './config/languages.js';
export * from './config/voice.js';

// Types
export * from './types/index.js';

// Voice Processing (Hume + Deepgram)
export * from './voice/index.js';

// Safety Rules
export * from './safety/index.js';

// Knowledge System
export * from './knowledge/index.js';
import { initializeKnowledge } from './knowledge/index.js';

// Prompts (Multi-language)
export * from './i18n/prompts/index.js';

// Utilities
export * from './utils/index.js';
export { logger } from './utils/logger.js';

// Version
export const VERSION = '0.1.0';
export const SUPPORTED_LANGUAGES = ['en', 'es', 'fr'] as const;

console.log(`🏥 HELIOS Healthcare AI Platform v${VERSION}`);
console.log(`📍 Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}`);

// Auto-initialize knowledge on import
initializeKnowledge();
