/**
 * Manus-Parity Integration Module
 * 
 * This module provides 100% feature parity with the Manus.im platform,
 * including the agent orchestrator, API client, and React hooks.
 * 
 * @module manus
 */

// Types
export * from './types';

// Orchestrator
export {
  AgentStateMachine,
  PlanManager,
  EventEmitter,
  AgentOrchestrator,
  createOrchestrator,
  type OrchestratorConfig,
} from './orchestrator';

// API Client
export {
  ManusApiClient,
  createApiClient,
  getApiClient,
  setApiClient,
  type ApiClientConfig,
} from './api-client';

// React Hooks
export {
  useAgentTask,
  useAgentStream,
  useTaskList,
  useAgentHealth,
  type UseAgentTaskOptions,
  type UseAgentTaskReturn,
  type UseAgentStreamReturn,
  type UseTaskListOptions,
  type UseTaskListReturn,
  type UseAgentHealthReturn,
} from './hooks';
