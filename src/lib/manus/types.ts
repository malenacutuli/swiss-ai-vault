/**
 * Manus-Parity Type Definitions
 * 
 * These types mirror the Manus.im platform architecture for 100% feature parity.
 * Based on the SwissVault_Manus_Integration.md specification.
 */

// =============================================================================
// AGENT STATE MACHINE
// =============================================================================

export type AgentState = 
  | 'IDLE'
  | 'PLANNING'
  | 'EXECUTING'
  | 'WAITING'
  | 'DELIVERING'
  | 'COMPLETED'
  | 'FAILED';

export type StateTransition = {
  from: AgentState;
  to: AgentState;
  trigger: string;
};

export const ALLOWED_TRANSITIONS: StateTransition[] = [
  { from: 'IDLE', to: 'PLANNING', trigger: 'new_task' },
  { from: 'PLANNING', to: 'EXECUTING', trigger: 'plan_created' },
  { from: 'EXECUTING', to: 'EXECUTING', trigger: 'tool_success' },
  { from: 'EXECUTING', to: 'EXECUTING', trigger: 'tool_failure_retry' },
  { from: 'EXECUTING', to: 'WAITING', trigger: 'user_input_needed' },
  { from: 'WAITING', to: 'EXECUTING', trigger: 'user_responds' },
  { from: 'EXECUTING', to: 'DELIVERING', trigger: 'task_complete' },
  { from: 'DELIVERING', to: 'IDLE', trigger: 'result_sent' },
  { from: 'EXECUTING', to: 'FAILED', trigger: 'max_retries_exceeded' },
  { from: 'PLANNING', to: 'FAILED', trigger: 'planning_failed' },
];

// =============================================================================
// TASK PLANNING
// =============================================================================

export interface TaskPlan {
  goal: string;
  phases: Phase[];
  currentPhaseId: number;
}

export interface Phase {
  id: number;
  title: string;
  capabilities: PhaseCapabilities;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface PhaseCapabilities {
  creativeWriting?: boolean;
  dataAnalysis?: boolean;
  deepResearch?: boolean;
  imageProcessing?: boolean;
  mediaGeneration?: boolean;
  parallelProcessing?: boolean;
  slidesContentWriting?: boolean;
  slidesGeneration?: boolean;
  technicalWriting?: boolean;
  webDevelopment?: boolean;
}

export type PlanAction = 'update' | 'advance';

export interface PlanUpdateParams {
  action: 'update';
  goal: string;
  phases: Omit<Phase, 'status'>[];
  currentPhaseId: number;
}

export interface PlanAdvanceParams {
  action: 'advance';
  currentPhaseId: number;
  nextPhaseId: number;
}

export type PlanParams = PlanUpdateParams | PlanAdvanceParams;

// =============================================================================
// TOOL SYSTEM
// =============================================================================

export type ToolName = 
  | 'plan'
  | 'message'
  | 'shell'
  | 'file'
  | 'match'
  | 'search'
  | 'browser'
  | 'expose'
  | 'schedule'
  | 'map'
  | 'generate'
  | 'slides'
  | 'webdev_init_project';

export interface ToolCall {
  id: string;
  name: ToolName;
  parameters: Record<string, unknown>;
  timestamp: string;
}

export interface ToolResult {
  toolCallId: string;
  success: boolean;
  output: unknown;
  error?: string;
  durationMs: number;
}

// Message Tool Types
export type MessageType = 'info' | 'ask' | 'result';
export type SuggestedAction = 
  | 'none'
  | 'confirm_browser_operation'
  | 'take_over_browser'
  | 'upgrade_to_unlock_feature';

export interface MessageParams {
  type: MessageType;
  text: string;
  attachments?: string[];
  suggestedAction?: SuggestedAction;
}

// File Tool Types
export type FileAction = 'view' | 'read' | 'write' | 'append' | 'edit';

export interface FileEdit {
  find: string;
  replace: string;
  all?: boolean;
}

export interface FileParams {
  action: FileAction;
  path: string;
  brief: string;
  text?: string;
  edits?: FileEdit[];
  range?: [number, number];
}

// Shell Tool Types
export type ShellAction = 'view' | 'exec' | 'wait' | 'send' | 'kill';

export interface ShellParams {
  action: ShellAction;
  session: string;
  brief: string;
  command?: string;
  input?: string;
  timeout?: number;
}

// Search Tool Types
export type SearchType = 'info' | 'image' | 'api' | 'news' | 'tool' | 'data' | 'research';
export type SearchTimeFilter = 'all' | 'past_day' | 'past_week' | 'past_month' | 'past_year';

export interface SearchParams {
  type: SearchType;
  queries: string[];
  brief: string;
  time?: SearchTimeFilter;
}

// Browser Tool Types
export type BrowserIntent = 'navigational' | 'informational' | 'transactional';

export interface BrowserParams {
  url: string;
  intent: BrowserIntent;
  brief: string;
  focus?: string;
}

// Map Tool Types (Wide Research)
export interface OutputField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'file';
  title: string;
  description: string;
  format: string;
}

export interface MapParams {
  name: string;
  title: string;
  promptTemplate: string;
  targetCount: number;
  inputs: string[];
  outputSchema: OutputField[];
  brief: string;
}

// Schedule Tool Types
export type ScheduleType = 'cron' | 'interval';

export interface ScheduleParams {
  type: ScheduleType;
  repeat: boolean;
  name: string;
  prompt: string;
  brief: string;
  cron?: string;
  interval?: number;
  expire?: string;
  playbook?: string;
}

// =============================================================================
// EVENT STREAMING
// =============================================================================

export type EventType = 
  | 'task.created'
  | 'plan.updated'
  | 'phase.started'
  | 'action.started'
  | 'action.completed'
  | 'observation.received'
  | 'message.sent'
  | 'knowledge.injected'
  | 'task.completed'
  | 'task.failed'
  | 'error';

export interface AgentEvent {
  event: EventType;
  taskId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface TaskCreatedEvent extends AgentEvent {
  event: 'task.created';
  data: {
    prompt: string;
    userId: string;
  };
}

export interface PlanUpdatedEvent extends AgentEvent {
  event: 'plan.updated';
  data: {
    plan: TaskPlan;
  };
}

export interface ActionCompletedEvent extends AgentEvent {
  event: 'action.completed';
  data: {
    toolName: ToolName;
    parameters: Record<string, unknown>;
    result: ToolResult;
  };
}

// =============================================================================
// TASK MANAGEMENT
// =============================================================================

export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Task {
  id: string;
  userId: string;
  prompt: string;
  status: TaskStatus;
  plan?: TaskPlan;
  state: AgentState;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  result?: TaskResult;
  error?: TaskError;
}

export interface TaskResult {
  text: string;
  attachments: string[];
  metadata?: Record<string, unknown>;
}

export interface TaskError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface CreateTaskRequest {
  prompt: string;
  goal?: string;
  attachments?: string[];
  webhookUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateTaskResponse {
  taskId: string;
  status: TaskStatus;
  createdAt: string;
  streamingUrl: string;
}

// =============================================================================
// SANDBOX ENVIRONMENT
// =============================================================================

export interface SandboxConfig {
  cpu: number;
  memory: number;
  disk: number;
  timeout: number;
  networkAccess: boolean;
}

export const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  cpu: 2,
  memory: 4096, // MB
  disk: 10240, // MB
  timeout: 300, // seconds
  networkAccess: true,
};

export interface SandboxSession {
  id: string;
  status: 'creating' | 'running' | 'hibernating' | 'terminated';
  createdAt: string;
  lastActiveAt: string;
  config: SandboxConfig;
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

export type ErrorCode = 
  | 'E001' // Invalid request format
  | 'E002' // Authentication failed
  | 'E003' // Rate limit exceeded
  | 'E004' // Resource not found
  | 'E005' // Internal server error
  | 'E006' // Task timeout
  | 'E007'; // Sandbox unavailable

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
  retryAfter?: number;
}

// =============================================================================
// RETRY CONFIGURATION
// =============================================================================

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

// =============================================================================
// WIDE RESEARCH (PARALLEL PROCESSING)
// =============================================================================

export interface WideResearchRequest {
  query: string;
  depth: number;
  maxSubtasks: number;
}

export interface WideResearchSubtask {
  id: string;
  input: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: Record<string, unknown>;
  error?: string;
}

export interface WideResearchResult {
  query: string;
  subtasks: WideResearchSubtask[];
  synthesis: string;
  completedAt: string;
}
