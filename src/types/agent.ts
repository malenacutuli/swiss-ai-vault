/**
 * Swiss Agents V2 - Type Definitions
 * Manus-parity implementation types
 */

// ===========================================
// TASK STATE MACHINE
// ===========================================

export type TaskState =
  | 'idle'
  | 'planning'
  | 'executing'
  | 'waiting_user'
  | 'completed'
  | 'failed'
  | 'cancelled';

export const VALID_TRANSITIONS: Record<TaskState, TaskState[]> = {
  idle: ['planning'],
  planning: ['executing', 'failed', 'cancelled'],
  executing: ['waiting_user', 'completed', 'failed', 'cancelled'],
  waiting_user: ['executing', 'cancelled'],
  completed: [], // Terminal state
  failed: [], // Terminal state
  cancelled: [], // Terminal state
};

// ===========================================
// TASK TYPES
// ===========================================

export interface Task {
  id: string;
  userId: string;
  prompt: string;
  state: TaskState;
  plan: ExecutionPlan | null;
  currentPhaseId: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  error: string | null;
  result: TaskResult | null;
}

export interface ExecutionPlan {
  goal: string;
  phases: PlanPhase[];
}

export interface PlanPhase {
  id: number;
  title: string;
  description?: string;
  capabilities: PhaseCapabilities;
  status: 'pending' | 'active' | 'completed' | 'failed';
}

export interface PhaseCapabilities {
  web_development?: boolean;
  data_analysis?: boolean;
  deep_research?: boolean;
  creative_writing?: boolean;
  technical_writing?: boolean;
  image_processing?: boolean;
  media_generation?: boolean;
  parallel_processing?: boolean;
  slides_content_writing?: boolean;
  slides_generation?: boolean;
}

export interface TaskResult {
  message: string;
  attachments: Attachment[];
}

export interface Attachment {
  type: 'file' | 'url' | 'image';
  name: string;
  path: string;
  mimeType?: string;
  size?: number;
}

// ===========================================
// TOOL TYPES
// ===========================================

export type ToolName =
  | 'message'
  | 'plan'
  | 'shell'
  | 'file'
  | 'match'
  | 'search'
  | 'browser_navigate'
  | 'browser_click'
  | 'browser_input'
  | 'browser_scroll'
  | 'browser_view'
  | 'generate'
  | 'slides'
  | 'map'
  | 'expose'
  | 'schedule';

export interface ToolCall {
  id: string;
  name: ToolName;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  success: boolean;
  output: string;
  error?: string;
  artifacts?: Artifact[];
}

export interface Artifact {
  type: 'file' | 'screenshot' | 'url';
  path: string;
  name?: string;
}

// ===========================================
// ACTION TYPES
// ===========================================

export interface AgentAction {
  type: 'tool' | 'message' | 'phase_complete' | 'task_complete' | 'request_input';
  toolName?: ToolName;
  toolInput?: Record<string, unknown>;
  message?: string;
  reasoning?: string;
}

// ===========================================
// API REQUEST/RESPONSE TYPES
// ===========================================

export interface CreateTaskRequest {
  prompt: string;
  attachments?: string[];
  options?: TaskOptions;
}

export interface TaskOptions {
  maxIterations?: number;
  timeout?: number;
  model?: string;
}

export interface CreateTaskResponse {
  taskId: string;
  status: TaskState;
  streamUrl: string;
}

export interface TaskStatusResponse {
  task: Task;
  steps: TaskStep[];
}

export interface TaskStep {
  id: string;
  taskId: string;
  stepNumber: number;
  toolName: ToolName;
  toolInput: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

// ===========================================
// SSE EVENT TYPES
// ===========================================

export type SSEEventType =
  | 'task_started'
  | 'plan_created'
  | 'phase_started'
  | 'phase_completed'
  | 'tool_started'
  | 'tool_output'
  | 'tool_completed'
  | 'message'
  | 'thinking'
  | 'task_completed'
  | 'task_failed'
  | 'error';

export interface SSEEvent {
  type: SSEEventType;
  timestamp: string;
  data: unknown;
}

export interface TaskStartedEvent {
  type: 'task_started';
  taskId: string;
  prompt: string;
}

export interface PlanCreatedEvent {
  type: 'plan_created';
  plan: ExecutionPlan;
}

export interface PhaseStartedEvent {
  type: 'phase_started';
  phaseId: number;
  title: string;
}

export interface ToolStartedEvent {
  type: 'tool_started';
  toolName: ToolName;
  toolInput: Record<string, unknown>;
}

export interface ToolOutputEvent {
  type: 'tool_output';
  toolName: ToolName;
  output: string;
  isPartial: boolean;
}

export interface MessageEvent {
  type: 'message';
  role: 'assistant' | 'user';
  content: string;
}

export interface ThinkingEvent {
  type: 'thinking';
  content: string;
}

export interface TaskCompletedEvent {
  type: 'task_completed';
  result: TaskResult;
}

export interface TaskFailedEvent {
  type: 'task_failed';
  error: string;
}
