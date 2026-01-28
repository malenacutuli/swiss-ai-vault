/**
 * Triage Agent Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { ESICalculatorAgent } from '../../../src/agents/triage/esi-calculator.js';
import type { AgentContext } from '../../../src/agents/types.js';

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify({
          esi_level: 'ESI3',
          decision_path: 'C',
          rationale: 'Stable patient requiring multiple resources',
          resources_needed: ['labs', 'ECG', 'chest X-ray'],
          resource_count: 3,
          danger_signs: [],
          confidence: 0.85,
          time_sensitivity: 'within_1h',
        })}],
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    },
  })),
}));

describe('ESICalculatorAgent', () => {
  let agent: ESICalculatorAgent;
  let mockClient: Anthropic;

  beforeEach(() => {
    mockClient = new Anthropic({ apiKey: 'test-key' });
    agent = new ESICalculatorAgent(mockClient);
  });

  it('should have correct configuration', () => {
    expect(agent.id).toBe('esi_calc_001');
    expect(agent.role).toBe('esi_calculator');
    expect(agent.team).toBe('triage');
  });

  it('should calculate ESI level', async () => {
    const context: AgentContext = {
      sessionId: 'test-session',
      caseState: {
        session_id: 'test-session',
        language: 'en',
        current_phase: 'triage',
        phase_history: [],
        chief_complaint: 'chest pain',
        messages: [],
        symptom_entities: [{
          symptom: 'chest pain',
          severity: 5,
          extracted_at: new Date().toISOString(),
          confidence: 0.8,
        }],
        hypothesis_list: [],
        red_flags: [],
        escalation_triggered: false,
        escalation_reason: null,
        triage_level: null,
        disposition: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      language: 'en',
      currentPhase: 'triage',
      previousOutputs: new Map(),
    };

    const output = await agent.execute({ context });

    expect(output.agentId).toBe('esi_calc_001');
    expect(output.success).toBe(true);
    expect(output.content).toBeDefined();
  });

  it('should classify ESI-1 for life-threatening symptoms', async () => {
    vi.mocked(mockClient.messages.create).mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify({
        esi_level: 'ESI1',
        decision_path: 'A',
        rationale: 'Patient is unresponsive - requires immediate intervention',
        resources_needed: ['resuscitation', 'airway management'],
        resource_count: 5,
        danger_signs: ['unresponsive', 'not breathing'],
        confidence: 0.95,
        time_sensitivity: 'immediate',
      })}],
      usage: { input_tokens: 100, output_tokens: 50 },
    } as any);

    const context: AgentContext = {
      sessionId: 'test-session',
      caseState: {
        session_id: 'test-session',
        language: 'en',
        current_phase: 'triage',
        phase_history: [],
        chief_complaint: 'Found unresponsive',
        messages: [],
        symptom_entities: [{
          symptom: 'unresponsive',
          extracted_at: new Date().toISOString(),
          confidence: 0.9,
        }],
        hypothesis_list: [],
        red_flags: [],
        escalation_triggered: false,
        escalation_reason: null,
        triage_level: null,
        disposition: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      language: 'en',
      currentPhase: 'triage',
      previousOutputs: new Map(),
    };

    const output = await agent.execute({ context });

    expect(output.success).toBe(true);
  });
});
