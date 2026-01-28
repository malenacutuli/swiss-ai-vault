import { describe, it, expect } from 'vitest';
import { getPrompt, getGreeting, getEmergencyMessage } from '../../src/i18n/prompts/index.js';

describe('Multi-Language Prompts', () => {
  describe('Greetings', () => {
    it('should return English greeting', () => {
      const greeting = getGreeting('en');
      expect(greeting).toContain('Hello');
      expect(greeting).toContain('health assistant');
    });

    it('should return Spanish greeting', () => {
      const greeting = getGreeting('es');
      expect(greeting).toContain('Hola');
      expect(greeting).toContain('asistente de salud');
    });

    it('should return French greeting', () => {
      const greeting = getGreeting('fr');
      expect(greeting).toContain('Bonjour');
      expect(greeting).toContain('assistant de santé');
    });
  });

  describe('Emergency Messages', () => {
    it('should return correct emergency numbers', () => {
      const enMsg = getEmergencyMessage('chest_pain', 'en');
      const esMsg = getEmergencyMessage('chest_pain', 'es');
      const frMsg = getEmergencyMessage('chest_pain', 'fr');

      expect(enMsg).toContain('911');
      expect(esMsg).toContain('911');
      expect(frMsg).toContain('15');
    });

    it('should return correct suicide hotlines', () => {
      const enMsg = getEmergencyMessage('suicide', 'en');
      const esMsg = getEmergencyMessage('suicide', 'es');
      const frMsg = getEmergencyMessage('suicide', 'fr');

      expect(enMsg).toContain('988');
      expect(esMsg).toContain('024');
      expect(frMsg).toContain('3114');
    });
  });

  describe('System Prompts', () => {
    it('should contain safety rules in all languages', () => {
      const enPrompt = getPrompt('orchestrator', 'en');
      const esPrompt = getPrompt('orchestrator', 'es');
      const frPrompt = getPrompt('orchestrator', 'fr');

      expect(enPrompt).toContain('NEVER');
      expect(esPrompt).toContain('NUNCA');
      expect(frPrompt).toContain('JAMAIS');
    });
  });
});
