// ═══════════════════════════════════════════════════════════════════════════
// AGENT EXECUTOR - Manus-style agentic execution loop
// ═══════════════════════════════════════════════════════════════════════════

export { 
  AgentExecutor, 
  createAgentExecutor,
  type ExecutionPlan,
  type PlanStep,
  type ToolCall,
  type ExecutorConfig,
} from './AgentExecutor';

// ═══════════════════════════════════════════════════════════════════════════
// TOOL SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

export {
  toolRegistry,
  executeTool,
  getToolInfo,
  listTools,
  getToolsBySafety,
  TOOL_COUNT,
  toolCategories,
  toolsBySafety,
  toolsRequiringConfirmation,
} from './tools';

export * from './tools/types';
export * from './tools/schemas';

// ═══════════════════════════════════════════════════════════════════════════
// SAFETY SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

export {
  validateInput,
  validatePlan,
  validateExecution,
  validateOutput,
  validateAll,
  validatePreExecution,
  sanitizeAndValidate,
  isCommandBlocked,
  hasSQLInjection,
  hasPathTraversal,
  maskPII,
  maskSecrets,
  DEFAULT_SAFETY_CONFIG,
  CATEGORY_RATE_LIMITS,
  registerTaskStart,
  registerTaskEnd,
  requestConfirmation,
  respondToConfirmation,
  getPendingConfirmations,
  resetRateLimits,
  resetConcurrentTasks,
  sanitizeOutput,
  BLOCKED_COMMANDS,
  BLOCKED_PATTERNS,
} from './safety';

export type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  AgentPlan as SafetyAgentPlan,
  PlanStep as SafetyPlanStep,
  SafetyConfig,
  ConfirmationRequest,
  ConfirmationResult,
  SanitizedOutput,
} from './safety';

// ═══════════════════════════════════════════════════════════════════════════
// PLANNING SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

export {
  TodoParser,
  todoParser,
} from './planning';

export type {
  TodoPlan,
  Phase,
  Task,
  TaskStatus,
  PhaseStatus,
} from './planning';

// ═══════════════════════════════════════════════════════════════════════════
// CHECKPOINT SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

export {
  CheckpointManager,
  checkpointManager,
} from './checkpoints';

export type {
  Checkpoint,
  CheckpointState,
  CheckpointType,
  CheckpointMetadata,
  CheckpointSummary,
  FileState,
  ToolExecution,
  AgentContextState,
} from './checkpoints';