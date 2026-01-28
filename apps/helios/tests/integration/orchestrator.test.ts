/**
 * Orchestrator Integration Tests
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { HeliosOrchestrator } from '../../src/orchestrator/index.js';
import type { CaseState } from '../../src/types/index.js';

// Skip if no API key
const SKIP_INTEGRATION = !process.env.ANTHROPIC_API_KEY;

describe.skipIf(SKIP_INTEGRATION)('HeliosOrchestrator Integration', () => {
  let orchestrator: HeliosOrchestrator;

  beforeAll(() => {
    orchestrator = new HeliosOrchestrator(process.env.ANTHROPIC_API_KEY!);
  });

  it('should process initial message and extract chief complaint', async () => {
    const initialState: CaseState = {
      session_id: 'test-integration-001',
      language: 'en',
      current_phase: 'intake',
      phase_history: [],
      chief_complaint: null,
      symptom_entities: [],
      hypothesis_list: [],
      red_flags: [],
      escalation_triggered: false,
      escalation_reason: null,
      triage_level: null,
      disposition: null,
      messages: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const result = await orchestrator.process(
      initialState,
      'I have a headache that started this morning'
    );

    expect(result.escalated).toBe(false);
    expect(result.finalResponse).toBeDefined();
    expect(result.finalResponse.length).toBeGreaterThan(0);
  }, 30000);

  it('should immediately escalate for emergency symptoms', async () => {
    const initialState: CaseState = {
      session_id: 'test-integration-002',
      language: 'en',
      current_phase: 'intake',
      phase_history: [],
      chief_complaint: null,
      symptom_entities: [],
      hypothesis_list: [],
      red_flags: [],
      escalation_triggered: false,
      escalation_reason: null,
      triage_level: null,
      disposition: null,
      messages: [],
      patient_demographics: { age: 55, age_unit: 'years' },
      medical_history: ['hypertension', 'diabetes'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const result = await orchestrator.process(
      initialState,
      'I have severe chest pain radiating to my left arm'
    );

    expect(result.escalated).toBe(true);
    expect(result.finalResponse).toContain('911');
  }, 30000);

  it('should work in Spanish', async () => {
    const initialState: CaseState = {
      session_id: 'test-integration-003',
      language: 'es',
      current_phase: 'intake',
      phase_history: [],
      chief_complaint: null,
      symptom_entities: [],
      hypothesis_list: [],
      red_flags: [],
      escalation_triggered: false,
      escalation_reason: null,
      triage_level: null,
      disposition: null,
      messages: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const result = await orchestrator.process(
      initialState,
      'Tengo dolor de cabeza desde esta manana'
    );

    expect(result.escalated).toBe(false);
    expect(result.finalResponse).toBeDefined();
    // Response should be in Spanish
  }, 30000);
});
