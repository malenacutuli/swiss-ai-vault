// Multi-Agent Orchestration Types for Swiss Agents
// Implements a 5-agent pipeline: Planner → Researcher → Executor → Verifier → Synthesizer

export type AgentRole = 'planner' | 'researcher' | 'executor' | 'verifier' | 'synthesizer';

export interface AgentMessage {
  taskId: string;
  fromAgent: AgentRole;
  toAgent: AgentRole;
  messageType: 'request' | 'response' | 'handoff' | 'verification' | 'error';
  content: string;
  interactionId?: string; // Gemini interaction ID for context continuity
  attachments?: AgentAttachment[];
  timestamp?: string;
}

export interface AgentAttachment {
  type: 'document' | 'image' | 'chart' | 'data' | 'audio';
  name: string;
  url?: string;
  base64?: string;
  mimeType?: string;
}

export interface AgentConfig {
  role: AgentRole;
  model: string;
  thinkingLevel?: 'none' | 'low' | 'medium' | 'high';
  background?: boolean; // For async long-running tasks
  tools?: AgentTool[];
  systemPrompt?: string;
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface ExecutionPlan {
  taskId: string;
  summary: string;
  steps: PlanStep[];
  estimatedDuration: number;
  requiredAgents: AgentRole[];
}

export interface PlanStep {
  stepNumber: number;
  agent: AgentRole;
  action: string;
  toolName?: string;
  input: Record<string, any>;
  dependsOn?: number[]; // Step numbers this step depends on
  expectedOutput?: string;
}

export interface AgentResult {
  agent: AgentRole;
  stepNumber: number;
  status: 'success' | 'failed' | 'skipped';
  output: any;
  reasoning?: string;
  sources?: AgentSource[];
  duration_ms: number;
  tokensUsed?: number;
}

export interface AgentSource {
  type: 'web' | 'document' | 'ai_generated' | 'user_input';
  title: string;
  url?: string;
  snippet?: string;
  citationKey: string;
  relevanceScore: number;
}

export interface VerificationResult {
  passed: boolean;
  score: number; // 0-100
  issues: VerificationIssue[];
  suggestions: string[];
}

export interface VerificationIssue {
  severity: 'info' | 'warning' | 'error';
  category: 'accuracy' | 'completeness' | 'quality' | 'formatting';
  description: string;
  location?: string;
}

// Agent Pipeline Configuration
export const AGENT_CONFIGS: Record<AgentRole, AgentConfig> = {
  planner: {
    role: 'planner',
    model: 'google/gemini-2.5-flash',
    thinkingLevel: 'high',
    tools: [],
    systemPrompt: `You are a planning agent that decomposes complex tasks into executable steps.
Output a structured JSON plan with clear dependencies between steps.
Always ensure the plan ends with a synthesis step to produce final deliverables.`
  },
  researcher: {
    role: 'researcher',
    model: 'google/gemini-2.5-flash',
    thinkingLevel: 'medium',
    background: true,
    tools: [
      { name: 'web_search', description: 'Search the web', parameters: { query: 'string' } },
      { name: 'deep_research', description: 'Multi-source research', parameters: { topic: 'string', depth: 'number' } },
    ],
    systemPrompt: `You are a research agent that gathers information from multiple sources.
Always cite your sources with numbered references.
Prioritize recent, authoritative sources.`
  },
  executor: {
    role: 'executor',
    model: 'google/gemini-2.5-flash',
    thinkingLevel: 'medium',
    tools: [
      { name: 'code_execution', description: 'Run Python/JS code', parameters: { code: 'string', language: 'string' } },
      { name: 'image_generation', description: 'Generate images', parameters: { prompt: 'string' } },
      { name: 'chart_generation', description: 'Create data visualizations', parameters: { data: 'object', chartType: 'string' } },
    ],
    systemPrompt: `You are an executor agent that creates visualizations and runs code.
Validate all code before execution.
Store generated assets in the output storage.`
  },
  verifier: {
    role: 'verifier',
    model: 'google/gemini-2.5-pro', // Higher quality for verification
    thinkingLevel: 'high',
    tools: [],
    systemPrompt: `You are a verification agent that ensures quality and accuracy.
Check facts against sources, verify calculations, and validate formatting.
Return structured feedback with severity levels.`
  },
  synthesizer: {
    role: 'synthesizer',
    model: 'google/gemini-2.5-flash',
    thinkingLevel: 'medium',
    tools: [
      { name: 'document_generator', description: 'Create final documents', parameters: { format: 'string', content: 'object' } },
      { name: 'audio_briefing', description: 'Generate TTS summary', parameters: { text: 'string', voice: 'string' } },
    ],
    systemPrompt: `You are a synthesis agent that compiles final deliverables.
Combine research, visualizations, and verified content into polished outputs.
Support multiple output formats: MD, DOCX, PPTX, PDF.`
  },
};

// Orchestration state machine
export type OrchestrationState = 
  | 'initialized'
  | 'planning'
  | 'researching'
  | 'executing'
  | 'verifying'
  | 'synthesizing'
  | 'completed'
  | 'failed';

export interface OrchestrationContext {
  taskId: string;
  userId: string;
  state: OrchestrationState;
  plan?: ExecutionPlan;
  results: AgentResult[];
  messages: AgentMessage[];
  currentAgent?: AgentRole;
  startedAt: string;
  completedAt?: string;
}

// Helper to determine next agent in pipeline
export function getNextAgent(current: AgentRole): AgentRole | null {
  const pipeline: AgentRole[] = ['planner', 'researcher', 'executor', 'verifier', 'synthesizer'];
  const currentIndex = pipeline.indexOf(current);
  if (currentIndex === -1 || currentIndex === pipeline.length - 1) {
    return null;
  }
  return pipeline[currentIndex + 1];
}

// Helper to check if agent should run for this task
export function shouldRunAgent(agent: AgentRole, plan: ExecutionPlan): boolean {
  return plan.requiredAgents.includes(agent);
}
