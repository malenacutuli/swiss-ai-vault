/**
 * Unified Agent Execution Hook
 *
 * Provides a single interface that can switch between:
 * - K8s backend (api.swissbrain.ai)
 * - Manus.im API (via Supabase edge function)
 *
 * The backend is selected via:
 * 1. VITE_USE_MANUS_API environment variable
 * 2. Runtime override via useExecutionBackend state
 */

import { useAgentExecution } from './useAgentExecution';
import { useManusExecution } from './useManusExecution';

// Feature flag: use Manus.im API instead of K8s backend
// Can be set via VITE_USE_MANUS_API=true in .env
const USE_MANUS_API = import.meta.env.VITE_USE_MANUS_API === 'true';

export type ExecutionBackend = 'k8s' | 'manus';

interface UseUnifiedAgentExecutionOptions {
  backend?: ExecutionBackend;
  onComplete?: (task: any) => void;
  onError?: (error: string) => void;
  onStepComplete?: (step: any) => void;
  onTerminalOutput?: (line: any) => void;
}

/**
 * Unified hook that can use either K8s or Manus.im backend
 */
export function useUnifiedAgentExecution(options: UseUnifiedAgentExecutionOptions = {}) {
  // Determine which backend to use
  const backend = options.backend || (USE_MANUS_API ? 'manus' : 'k8s');

  // Initialize both hooks (only one will be actively used)
  const k8sExecution = useAgentExecution({
    onComplete: options.onComplete,
    onError: options.onError,
    onStepComplete: options.onStepComplete,
    onTerminalOutput: options.onTerminalOutput,
  });

  const manusExecution = useManusExecution({
    onComplete: options.onComplete,
    onError: options.onError,
    onStepComplete: options.onStepComplete,
    onTerminalOutput: options.onTerminalOutput,
  });

  // Return the selected backend's hook
  const execution = backend === 'manus' ? manusExecution : k8sExecution;

  return {
    ...execution,
    // Add metadata about which backend is in use
    backend,
    isUsingManus: backend === 'manus',
    isUsingK8s: backend === 'k8s',
  };
}

/**
 * Default export - same interface as useAgentExecution
 * Automatically selects backend based on environment
 */
export default useUnifiedAgentExecution;

// Re-export types
export type {
  ExecutionTask,
  ExecutionStep,
  TerminalLine,
  FileNode,
  TaskOutput,
  ChatMessage,
} from './useAgentExecution';
