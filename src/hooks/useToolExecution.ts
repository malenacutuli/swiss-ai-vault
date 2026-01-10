import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  executeTool, 
  getToolInfo, 
  listTools,
  validateSafety,
  type Tool,
  type ToolResult,
  type AgentContext,
} from '@/lib/agents/tools';

export interface ToolExecutionState {
  isExecuting: boolean;
  currentTool: string | null;
  pendingConfirmation: {
    tool: string;
    params: unknown;
    reason: string;
  } | null;
  lastResult: ToolResult | null;
  error: string | null;
  history: ToolExecutionRecord[];
}

export interface ToolExecutionRecord {
  id: string;
  tool: string;
  params: unknown;
  result: ToolResult;
  timestamp: Date;
  durationMs: number;
}

export interface UseToolExecutionOptions {
  taskId: string;
  userId: string;
  sessionId?: string;
  workspacePath?: string;
  browserSessionId?: string;
  onToolStart?: (tool: string, params: unknown) => void;
  onToolComplete?: (tool: string, result: ToolResult) => void;
  onConfirmationRequired?: (tool: string, params: unknown, reason: string) => void;
  autoConfirm?: boolean;
  maxHistorySize?: number;
}

export function useToolExecution(options: UseToolExecutionOptions) {
  const {
    taskId,
    userId,
    sessionId,
    workspacePath = '/home/sandbox',
    browserSessionId,
    onToolStart,
    onToolComplete,
    onConfirmationRequired,
    autoConfirm = false,
    maxHistorySize = 50,
  } = options;

  const [state, setState] = useState<ToolExecutionState>({
    isExecuting: false,
    currentTool: null,
    pendingConfirmation: null,
    lastResult: null,
    error: null,
    history: [],
  });

  const contextRef = useRef<AgentContext>({
    taskId,
    userId,
    sessionId,
    workspacePath,
    browserSessionId,
    permissions: ['shell', 'file', 'browser', 'search', 'webdev', 'plan', 'message'],
  });

  // Update context when options change
  contextRef.current = {
    taskId,
    userId,
    sessionId,
    workspacePath,
    browserSessionId,
    permissions: ['shell', 'file', 'browser', 'search', 'webdev', 'plan', 'message'],
  };

  const execute = useCallback(async (
    toolName: string, 
    params: unknown,
    skipConfirmation = false
  ): Promise<ToolResult> => {
    const tool = getToolInfo(toolName);
    
    if (!tool) {
      const error = `Unknown tool: ${toolName}`;
      setState(prev => ({ ...prev, error }));
      return { success: false, error };
    }

    // Check safety
    const safetyCheck = validateSafety(tool, params as Record<string, unknown>);
    
    if (!safetyCheck.allowed) {
      const error = safetyCheck.reason || 'Blocked by security policy';
      setState(prev => ({ ...prev, error }));
      return { success: false, error };
    }

    // Handle confirmation requirement
    if (safetyCheck.requiresConfirmation && !skipConfirmation && !autoConfirm) {
      setState(prev => ({
        ...prev,
        pendingConfirmation: {
          tool: toolName,
          params,
          reason: safetyCheck.reason || 'This operation requires confirmation',
        },
      }));
      
      onConfirmationRequired?.(toolName, params, safetyCheck.reason || '');
      
      return { 
        success: false, 
        error: 'Confirmation required',
        metadata: { requiresConfirmation: true },
      };
    }

    // Execute the tool
    setState(prev => ({
      ...prev,
      isExecuting: true,
      currentTool: toolName,
      error: null,
      pendingConfirmation: null,
    }));

    onToolStart?.(toolName, params);

    const startTime = Date.now();

    try {
      const result = await executeTool(toolName, params, contextRef.current);
      const durationMs = Date.now() - startTime;

      // Record execution
      const record: ToolExecutionRecord = {
        id: crypto.randomUUID(),
        tool: toolName,
        params,
        result,
        timestamp: new Date(),
        durationMs,
      };

      // Store in database
      await supabase.from('agent_tool_executions').insert([{
        task_id: taskId,
        tool_name: toolName,
        tool_category: tool.category,
        input_params: JSON.parse(JSON.stringify(params)),
        output_result: JSON.parse(JSON.stringify(result.output)),
        status: result.success ? 'success' : 'failed',
        execution_time_ms: durationMs,
        user_id: userId,
        error_message: result.error,
      }]);

      setState(prev => ({
        ...prev,
        isExecuting: false,
        currentTool: null,
        lastResult: result,
        error: result.success ? null : result.error || null,
        history: [record, ...prev.history].slice(0, maxHistorySize),
      }));

      onToolComplete?.(toolName, result);

      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Tool execution failed';
      
      setState(prev => ({
        ...prev,
        isExecuting: false,
        currentTool: null,
        error,
      }));

      return { success: false, error };
    }
  }, [taskId, userId, autoConfirm, maxHistorySize, onToolStart, onToolComplete, onConfirmationRequired]);

  const confirmPending = useCallback(async () => {
    const { pendingConfirmation } = state;
    if (!pendingConfirmation) return null;

    return execute(pendingConfirmation.tool, pendingConfirmation.params, true);
  }, [state, execute]);

  const cancelPending = useCallback(() => {
    setState(prev => ({
      ...prev,
      pendingConfirmation: null,
    }));
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const clearHistory = useCallback(() => {
    setState(prev => ({ ...prev, history: [] }));
  }, []);

  const getAvailableTools = useCallback((category?: string) => {
    return listTools(category as any);
  }, []);

  const getToolDetails = useCallback((toolName: string): Tool | undefined => {
    return getToolInfo(toolName);
  }, []);

  return {
    // State
    isExecuting: state.isExecuting,
    currentTool: state.currentTool,
    pendingConfirmation: state.pendingConfirmation,
    lastResult: state.lastResult,
    error: state.error,
    history: state.history,
    
    // Actions
    execute,
    confirmPending,
    cancelPending,
    clearError,
    clearHistory,
    
    // Utilities
    getAvailableTools,
    getToolDetails,
  };
}
