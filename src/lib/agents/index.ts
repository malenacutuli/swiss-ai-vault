// Tool system exports
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

// Safety system exports
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
  AgentPlan,
  PlanStep,
  SafetyConfig,
  ConfirmationRequest,
  ConfirmationResult,
  SanitizedOutput,
} from './safety';
