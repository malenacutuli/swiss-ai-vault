/**
 * Multi-Agent Coordination System
 * Exports all components for multi-agent task execution
 */

// Agent Registry
export {
  type AgentRole,
  type AgentCapability,
  type AgentDefinition,
  AGENT_CAPABILITIES,
  AGENT_DEFINITIONS,
  getAgentDefinition,
  getAgentsByCapability,
  selectBestAgent,
} from './AgentRegistry';

// Message Bus
export {
  type MessageType,
  type MessagePriority,
  type AgentMessage,
  type MessageHandler,
  MessageBus,
  createMessageBus,
} from './MessageBus';

// Shared State
export {
  type TaskStatus,
  type Phase,
  type Subtask,
  type Artifact,
  type AgentStatus,
  type SharedState,
  SharedStateManager,
  createSharedState,
} from './SharedState';

// Orchestrator
export {
  type TaskPlan,
  type OrchestratorConfig,
  Orchestrator,
  createOrchestrator,
} from './Orchestrator';

// Worker Agents
export {
  type WorkerContext,
  type WorkerResult,
  type WorkerStatus,
  type WorkerConfig,
  WorkerAgent,
} from './WorkerAgent';

// Specialized Agents
export {
  ResearcherAgent,
  CoderAgent,
  AnalystAgent,
  ReviewerAgent,
  createSpecializedAgent,
} from './SpecializedAgents';

// Conflict Resolution
export {
  type VectorClock,
  type ConflictEvent,
  type ConflictContender,
  type ConflictType,
  type ResolutionResult,
  ConflictResolver,
  createConflictResolver,
} from './ConflictResolver';

// Deadlock Prevention
export {
  type LockInfo,
  type WaitForEdge,
  type DeadlockResult,
  DeadlockPrevention,
  createDeadlockPrevention,
} from './DeadlockPrevention';
