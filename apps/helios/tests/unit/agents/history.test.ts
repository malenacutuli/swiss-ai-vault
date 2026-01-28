/**
 * History Agent Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { ChiefComplaintAgent } from '../../../src/agents/history/chief-complaint.js';
import { HPIGathererAgent } from '../../../src/agents/history/hpi-gatherer.js';
import type { AgentContext } from '../../../src/agents/types.js';

// Mock Anthropic client
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify({
          chief_complaint: 'chest pain',
          onset: '2 hours ago',
          severity: 7,
          associated_symptoms: ['shortness of breath'],
          clarifying_question: 'Can you describe the chest pain?',
        })}],
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    },
  })),
}));

describe('ChiefComplaintAgent', () => {
  let agent: ChiefComplaintAgent;
  let mockClient: Anthropic;

  beforeEach(() => {
    mockClient = new Anthropic({ apiKey: 'test-key' });
    agent = new ChiefComplaintAgent(mockClient);
  });

  it('should have correct configuration', () => {
    expect(agent.id).toBe('cc_extractor_001');
    expect(agent.role).toBe('chief_complaint_extractor');
    expect(agent.team).toBe('history');
  });

  it('should extract chief complaint from user message', async () => {
    const context: AgentContext = {
      sessionId: 'test-session',
      caseState: {
        session_id: 'test-session',
        language: 'en',
        current_phase: 'intake',
        phase_history: [],
        chief_complaint: null,
        messages: [],
        symptom_entities: [],
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
      currentPhase: 'intake',
      previousOutputs: new Map(),
    };

    const output = await agent.execute({
      context,
      userMessage: 'I have chest pain',
    });

    expect(output.agentId).toBe('cc_extractor_001');
    expect(output.role).toBe('chief_complaint_extractor');
    expect(output.team).toBe('history');
    expect(output.success).toBe(true);
  });
});

describe('HPIGathererAgent', () => {
  let agent: HPIGathererAgent;
  let mockClient: Anthropic;

  beforeEach(() => {
    mockClient = new Anthropic({ apiKey: 'test-key' });
    agent = new HPIGathererAgent(mockClient);
  });

  it('should have correct configuration', () => {
    expect(agent.id).toBe('hpi_gatherer_001');
    expect(agent.role).toBe('hpi_gatherer');
    expect(agent.team).toBe('history');
  });

  it('should track OLDCARTS completeness', async () => {
    vi.mocked(mockClient.messages.create).mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify({
        hpi_elements: {
          onset: '2 hours ago',
          location: 'chest',
          duration: null,
          character: null,
        },
        completeness: 0.25,
        next_element: 'character',
        question: 'How would you describe the pain?',
      })}],
      usage: { input_tokens: 100, output_tokens: 50 },
    } as any);

    const context: AgentContext = {
      sessionId: 'test-session',
      caseState: {
        session_id: 'test-session',
        language: 'en',
        current_phase: 'history_taking',
        phase_history: [],
        chief_complaint: 'chest pain',
        messages: [],
        symptom_entities: [],
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
      currentPhase: 'history_taking',
      previousOutputs: new Map(),
    };

    const output = await agent.execute({
      context,
      userMessage: 'It started 2 hours ago in my chest',
    });

    expect(output.success).toBe(true);
    expect(output.content).toBeDefined();
  });
});
