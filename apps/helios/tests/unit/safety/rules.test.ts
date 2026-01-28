/**
 * Safety Rules Engine Tests - All Languages
 */

import { describe, it, expect } from 'vitest';
import { checkSafetyRules, SAFETY_RULES, type PatientState } from '../../../src/safety/rules.js';

describe('Safety Rules Engine', () => {
  describe('Rule Coverage', () => {
    it('should have at least 10 safety rules', () => {
      expect(SAFETY_RULES.length).toBeGreaterThanOrEqual(10);
    });

    it('should have rules for all critical categories', () => {
      const categories = SAFETY_RULES.map(r => r.category);
      expect(categories).toContain('cardiac');
      expect(categories).toContain('neuro');
      expect(categories).toContain('psychiatric');
      expect(categories).toContain('pediatric');
      expect(categories).toContain('respiratory');
    });
  });

  describe('Cardiac Rules - All Languages', () => {
    const chestPainState: PatientState = {
      age: 55,
      ageUnit: 'years',
      symptoms: ['chest pain'],
      riskFactors: ['hypertension'],
      medications: [],
      messages: [],
    };

    it('should detect in English', () => {
      const result = checkSafetyRules(chestPainState, 'en');
      expect(result.triggered).toBe(true);
      expect(result.requiresEscalation).toBe(true);
      expect(result.redFlags[0].action_taken).toContain('911');
    });

    it('should detect in Spanish', () => {
      const state: PatientState = {
        ...chestPainState,
        symptoms: ['dolor de pecho'],
      };
      const result = checkSafetyRules(state, 'es');
      expect(result.triggered).toBe(true);
      expect(result.redFlags[0].action_taken).toContain('911');
    });

    it('should detect in French', () => {
      const state: PatientState = {
        ...chestPainState,
        symptoms: ['douleur thoracique'],
      };
      const result = checkSafetyRules(state, 'fr');
      expect(result.triggered).toBe(true);
      expect(result.redFlags[0].action_taken).toContain('15');
    });
  });

  describe('Psychiatric Rules - All Languages', () => {
    it('should detect English suicide keywords', () => {
      const state: PatientState = {
        symptoms: [],
        riskFactors: [],
        medications: [],
        messages: ['I want to kill myself'],
      };
      const result = checkSafetyRules(state, 'en');
      expect(result.triggered).toBe(true);
      expect(result.redFlags.some(f => f.rule_id === 'psych_001')).toBe(true);
      expect(result.redFlags[0].action_taken).toContain('988');
    });

    it('should detect Spanish suicide keywords', () => {
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

    it('should detect French suicide keywords', () => {
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
      expect(result.redFlags.some(f => f.rule_id === 'peds_001')).toBe(true);
    });

    it('should NOT trigger for older child with fever', () => {
      const state: PatientState = {
        age: 5,
        ageUnit: 'years',
        symptoms: ['fever'],
        riskFactors: [],
        medications: [],
        messages: [],
        temperature: 101,
      };
      const result = checkSafetyRules(state, 'en');
      // Should not trigger pediatric infant fever rule
      expect(result.redFlags.some(f => f.rule_id === 'peds_001')).toBe(false);
    });
  });

  describe('No False Positives', () => {
    it('should NOT trigger for common cold symptoms', () => {
      const state: PatientState = {
        age: 30,
        ageUnit: 'years',
        symptoms: ['runny nose', 'cough', 'mild headache'],
        riskFactors: [],
        medications: [],
        messages: ['I have a cold'],
      };
      const result = checkSafetyRules(state, 'en');
      expect(result.triggered).toBe(false);
    });

    it('should NOT trigger for routine questions', () => {
      const state: PatientState = {
        symptoms: [],
        riskFactors: [],
        medications: [],
        messages: ['What are your hours?', 'Do you accept insurance?'],
      };
      const result = checkSafetyRules(state, 'en');
      expect(result.triggered).toBe(false);
    });
  });
});
