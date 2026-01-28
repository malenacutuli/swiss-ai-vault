/**
 * Triage Agent Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { ESIClassifierAgent } from '../../../src/agents/triage/esi-classifier.js';
import type { AgentInput } from '../../../src/agents/types.js';

vi.mock('@anthropic-ai/sdk');

describe('ESIClassifierAgent', () => {
  let agent: ESIClassifierAgent;
  let mockClient: Anthropic;

  beforeEach(() => {
    mockClient = new Anthropic({ apiKey: 'test-key' });
    agent = new ESIClassifierAgent(mockClient);
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

    const input: AgentInput = {
      sessionId: 'test-session',
      caseState: {
        session_id: 'test-session',
        language: 'en',
        current_phase: 'triage',
        chief_complaint: 'Found unresponsive',
        symptom_entities: [{ symptom: 'unresponsive' }],
        messages: [],
        red_flags: [],
      } as any,
    };

    const output = await agent.process(input);

    expect(output.triageLevel).toBe('ESI1');
    expect(output.structuredOutput?.time_sensitivity).toBe('immediate');
  });

  it('should classify ESI-3 for urgent but stable patients', async () => {
    vi.mocked(mockClient.messages.create).mockResolvedValueOnce({
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
    } as any);

    const input: AgentInput = {
      sessionId: 'test-session',
      caseState: {
        session_id: 'test-session',
        language: 'en',
        current_phase: 'triage',
        chief_complaint: 'Abdominal pain for 2 days',
        symptom_entities: [{ symptom: 'abdominal pain', severity: 5 }],
        messages: [],
        red_flags: [],
      } as any,
    };

    const output = await agent.process(input);

    expect(output.triageLevel).toBe('ESI3');
    expect(output.structuredOutput?.resource_count).toBe(3);
  });
});
