/**
 * LangChain Multi-Agent Setup
 * Core configuration for 107-agent orchestration
 */

import { ChatAnthropic } from '@langchain/anthropic';
import { StateGraph, END, START } from '@langchain/langgraph';
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { RunnableConfig } from '@langchain/core/runnables';
import Redis from 'ioredis';

// Model configurations for different agent tiers (lazy-loaded)
let _modelsCache: {
  CLINICAL_REASONING: ChatAnthropic;
  ORCHESTRATION: ChatAnthropic;
  EXTRACTION: ChatAnthropic;
} | null = null;

let _apiKeyOverride: string | null = null;

/**
 * Set the Anthropic API key for model initialization
 * Call this before using AGENT_MODELS if ANTHROPIC_API_KEY is not in process.env
 */
export function setAnthropicApiKey(apiKey: string) {
  _apiKeyOverride = apiKey;
  _modelsCache = null; // Reset cache to use new key
}

function getModels() {
  if (_modelsCache) return _modelsCache;

  const apiKey = _apiKeyOverride || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY not found. Either set ANTHROPIC_API_KEY environment variable ' +
      'or call setAnthropicApiKey() before using the LangChain orchestrator.'
    );
  }

  _modelsCache = {
    // Tier 1: Critical reasoning (Opus)
    CLINICAL_REASONING: new ChatAnthropic({
      modelName: 'claude-opus-4-5-20251101',
      anthropicApiKey: apiKey,
      temperature: 0.1,
      maxTokens: 4096,
    }),

    // Tier 2: Orchestration & coordination (Sonnet)
    ORCHESTRATION: new ChatAnthropic({
      modelName: 'claude-sonnet-4-5-20250929',
      anthropicApiKey: apiKey,
      temperature: 0.2,
      maxTokens: 2048,
    }),

    // Tier 3: Fast extraction & transcription (Haiku)
    EXTRACTION: new ChatAnthropic({
      modelName: 'claude-haiku-4-5-20251001',
      anthropicApiKey: apiKey,
      temperature: 0.1,
      maxTokens: 1024,
    }),
  };

  return _modelsCache;
}

// Getter for models (lazy initialization)
export const AGENT_MODELS = {
  get CLINICAL_REASONING() { return getModels().CLINICAL_REASONING; },
  get ORCHESTRATION() { return getModels().ORCHESTRATION; },
  get EXTRACTION() { return getModels().EXTRACTION; },
};

// Redis for inter-agent communication (optional)
// Falls back to in-memory mode if Redis is not available
function createRedisClient(): typeof Redis.prototype | null {
  const redisUrl = process.env.UPSTASH_REDIS_URL;
  const redisToken = process.env.UPSTASH_REDIS_TOKEN;

  // Skip if no URL or if URL doesn't look like a valid Redis URL
  if (!redisUrl || (!redisUrl.startsWith('redis://') && !redisUrl.startsWith('rediss://'))) {
    console.log('[HELIOS] Redis not configured, using in-memory mode for agent communication');
    return null;
  }

  try {
    const client = new Redis(redisUrl, {
      password: redisToken,
      tls: redisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
      lazyConnect: true, // Don't connect immediately
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          console.log('[HELIOS] Redis connection failed, falling back to in-memory mode');
          return null; // Stop retrying
        }
        return Math.min(times * 100, 1000);
      },
    });

    // Handle errors gracefully
    client.on('error', (err) => {
      console.warn('[HELIOS] Redis error (non-fatal):', err.message);
    });

    client.on('connect', () => {
      console.log('[HELIOS] Redis connected successfully');
    });

    return client;
  } catch (error) {
    console.log('[HELIOS] Failed to create Redis client, using in-memory mode');
    return null;
  }
}

export const redis = createRedisClient();

// Agent communication channels
export const CHANNELS = {
  AGENT_INBOX: (agentId: string) => `helios:agent:${agentId}:inbox`,
  AGENT_OUTBOX: (agentId: string) => `helios:agent:${agentId}:outbox`,
  TEAM_CHANNEL: (team: string) => `helios:team:${team}:messages`,
  CONSENSUS_CHANNEL: (sessionId: string) => `helios:session:${sessionId}:consensus`,
  BROADCAST: 'helios:broadcast',
};

export type SupportedLanguage = 'en' | 'es' | 'fr';

// Agent State interface for LangGraph
export interface AgentState {
  sessionId: string;
  messages: BaseMessage[];
  currentPhase: string;
  activeAgents: string[];
  consultations: AgentConsultation[];
  consensus: ConsensusState | null;
  caseState: CaseStateData;
  metadata: Record<string, unknown>;
}

export interface AgentConsultation {
  fromAgent: string;
  toAgent: string;
  question: string;
  response?: string;
  timestamp: string;
  status: 'pending' | 'answered' | 'timeout';
}

export interface ConsensusState {
  topic: string;
  votes: Record<string, { vote: string; confidence: number; rationale: string }>;
  result?: string;
  requiredVotes: number;
  deadline: string;
}

export interface CaseStateData {
  chiefComplaint?: string;
  demographics?: { age: number; sex: string };
  symptoms: SymptomData[];
  hypotheses: HypothesisData[];
  redFlags: RedFlagData[];
  triageLevel?: string;
  disposition?: string;
}

export interface SymptomData {
  name: string;
  present: boolean;
  duration?: string;
  severity?: string;
  location?: string;
}

export interface HypothesisData {
  name: string;
  confidence: number;
  supportingEvidence: string[];
  againstEvidence: string[];
  icdCode?: string;
}

export interface RedFlagData {
  description: string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  action: string;
}

// Initial state factory
export function createInitialState(sessionId: string): AgentState {
  return {
    sessionId,
    messages: [],
    currentPhase: 'intake',
    activeAgents: [],
    consultations: [],
    consensus: null,
    caseState: {
      symptoms: [],
      hypotheses: [],
      redFlags: [],
    },
    metadata: {},
  };
}

// Helper to create messages
export function createSystemMessage(content: string): SystemMessage {
  return new SystemMessage(content);
}

export function createHumanMessage(content: string): HumanMessage {
  return new HumanMessage(content);
}

export function createAIMessage(content: string): AIMessage {
  return new AIMessage(content);
}
