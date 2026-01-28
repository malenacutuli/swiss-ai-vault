import { describe, it, expect } from 'vitest';
import { checkSafetyRules, type PatientState } from '../../src/safety/rules.js';

describe('Safety Rules Engine', () => {
  describe('Cardiac Rules', () => {
    it('should detect chest pain with risk factors (English)', () => {
      const state: PatientState = {
        age: 55,
        ageUnit: 'years',
        symptoms: ['chest pain'],
        riskFactors: ['hypertension'],
        medications: [],
        messages: [],
      };

      const result = checkSafetyRules(state, 'en');

      expect(result.triggered).toBe(true);
      expect(result.requiresEscalation).toBe(true);
      expect(result.redFlags.some(f => f.rule_id === 'cardiac_001')).toBe(true);
    });

    it('should detect chest pain with risk factors (Spanish)', () => {
      const state: PatientState = {
        symptoms: [],
        riskFactors: ['diabético'],
        medications: [],
        messages: ['tengo dolor de pecho muy fuerte'],
      };

      const result = checkSafetyRules(state, 'es');

      expect(result.triggered).toBe(true);
      expect(result.redFlags[0].action_taken).toContain('911');
    });

    it('should detect chest pain with risk factors (French)', () => {
      const state: PatientState = {
        age: 45,
        ageUnit: 'years',
        symptoms: [],
        riskFactors: [],
        medications: [],
        messages: ['j\'ai une douleur thoracique'],
      };

      const result = checkSafetyRules(state, 'fr');

      expect(result.triggered).toBe(true);
      expect(result.redFlags[0].action_taken).toContain('15');
    });
  });

  describe('Psychiatric Rules', () => {
    it('should detect suicidal ideation (English)', () => {
      const state: PatientState = {
        symptoms: [],
        riskFactors: [],
        medications: [],
        messages: ['I want to kill myself'],
      };

      const result = checkSafetyRules(state, 'en');

      expect(result.triggered).toBe(true);
      expect(result.requiresEscalation).toBe(true);
      expect(result.redFlags.some(f => f.rule_id === 'psych_001')).toBe(true);
      expect(result.redFlags[0].action_taken).toContain('988');
    });

    it('should detect suicidal ideation (Spanish)', () => {
      const state: PatientState = {
        symptoms: [],
        riskFactors: [],
        medications: [],
        messages: ['quiero morir'],
      };

      const result = checkSafetyRules(state, 'es');

      expect(result.triggered).toBe(true);
      expect(result.redFlags[0].action_taken).toContain('024');
    });

    it('should detect suicidal ideation (French)', () => {
      const state: PatientState = {
        symptoms: [],
        riskFactors: [],
        medications: [],
        messages: ['je veux me tuer'],
      };

      const result = checkSafetyRules(state, 'fr');

      expect(result.triggered).toBe(true);
      expect(result.redFlags[0].action_taken).toContain('3114');
    });
  });

  describe('Pediatric Rules', () => {
    it('should detect infant fever', () => {
      const state: PatientState = {
        age: 2,
        ageUnit: 'months',
        symptoms: ['fever'],
        riskFactors: [],
        medications: [],
        messages: [],
        temperature: 101,
      };

      const result = checkSafetyRules(state, 'en');

      expect(result.triggered).toBe(true);
      expect(result.requiresEscalation).toBe(true);
      expect(result.redFlags.some(f => f.rule_id === 'peds_001')).toBe(true);
    });
  });

  describe('No False Positives', () => {
    it('should not trigger for normal symptoms', () => {
      const state: PatientState = {
        age: 30,
        ageUnit: 'years',
        symptoms: ['headache', 'runny nose'],
        riskFactors: [],
        medications: [],
        messages: ['I have a cold'],
      };

      const result = checkSafetyRules(state, 'en');

      expect(result.triggered).toBe(false);
      expect(result.requiresEscalation).toBe(false);
    });
  });
});
