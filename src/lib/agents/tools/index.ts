// Types
export type {
  Tool,
  ToolCategory,
  ToolSafety,
  RateLimit,
  AgentContext,
  ToolResult,
  ToolRegistry,
  RateLimitState,
  ExecutionOptions,
  ToolAuditEntry,
} from './types';

// Registry
export {
  toolRegistry,
  TOOL_COUNT,
  toolCategories,
  toolsBySafety,
  toolsRequiringConfirmation,
} from './registry';

// Executor
export {
  executeTool,
  getToolInfo,
  listTools,
  getToolsBySafety,
  resetRateLimits,
} from './executor';

// Safety module
export {
  validateSafety,
  validateCommand,
  validatePath,
  validateUrl,
  sanitizeForLogging,
  RATE_LIMITS,
  getToolSafetyClassification,
  type SafetyValidationResult,
} from './safety';

// Schemas
export * from './schemas';

// Individual tool implementations (for direct access)
export {
  shellExec,
  shellView,
  fileRead,
  fileWrite,
  fileEdit,
  fileDelete,
  browserNavigate,
  browserClick,
  browserType,
  browserScreenshot,
  searchWeb,
  searchCode,
  webdevInit,
  webdevPreview,
  planUpdate,
  planAdvance,
  messageInfo,
  messageAsk,
} from './implementations';
