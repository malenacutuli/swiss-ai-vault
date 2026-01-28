/**
 * History Agent Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { ChiefComplaintAgent } from '../../../src/agents/history/chief-complaint.js';
import { HPIInterviewerAgent } from '../../../src/agents/history/hpi-interviewer.js';
import type { AgentInput } from '../../../src/agents/types.js';

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

  it('should extract chief complaint from user message', async () => {
    const input: AgentInput = {
      sessionId: 'test-session',
      caseState: {
        session_id: 'test-session',
        language: 'en',
        current_phase: 'intake',
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
      } as any,
      userMessage: 'I have chest pain',
    };

    const output = await agent.process(input);

    expect(output.agentId).toBe('history-cc-001');
    expect(output.role).toBe('chief_complaint_collector');
    expect(output.team).toBe('history');
    expect(output.structuredOutput).toBeDefined();
    expect(output.structuredOutput?.chief_complaint).toBe('chest pain');
  });

  it('should generate clarifying question', async () => {
    const input: AgentInput = {
      sessionId: 'test-session',
      caseState: {
        session_id: 'test-session',
        language: 'en',
        current_phase: 'intake',
        messages: [],
      } as any,
      userMessage: 'I feel sick',
    };

    const output = await agent.process(input);

    expect(output.response).toBeDefined();
    expect(output.response?.length).toBeGreaterThan(0);
  });
});

describe('HPIInterviewerAgent', () => {
  let agent: HPIInterviewerAgent;
  let mockClient: Anthropic;

  beforeEach(() => {
    mockClient = new Anthropic({ apiKey: 'test-key' });
    agent = new HPIInterviewerAgent(mockClient);
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

    const input: AgentInput = {
      sessionId: 'test-session',
      caseState: {
        session_id: 'test-session',
        language: 'en',
        current_phase: 'history_taking',
        messages: [],
        symptom_entities: [],
      } as any,
      userMessage: 'It started 2 hours ago in my chest',
    };

    const output = await agent.process(input);

    expect(output.structuredOutput?.completeness).toBeDefined();
    expect(output.structuredOutput?.next_element).toBe('character');
  });
});
