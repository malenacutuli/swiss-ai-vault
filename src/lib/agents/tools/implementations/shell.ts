import type { Tool, AgentContext, ToolResult } from '../types';
import { shellExecSchema, shellViewSchema } from '../schemas/shell';
import { validateCommand, sanitizeForLogging } from '../safety';
import { supabase } from '@/integrations/supabase/client';

// Swiss API endpoint (HTTP for now due to SSL certificate provisioning)
const SWISS_API_ENDPOINT = 'http://api.swissbrain.ai';

// shell.exec - Execute shell command
export const shellExec: Tool = {
  name: 'shell.exec',
  description: 'Execute a shell command in the agent workspace. Use for running scripts, installing packages, or system operations.',
  category: 'shell',
  schema: shellExecSchema,
  safety: 'dangerous',
  rateLimit: { requests: 10, windowMs: 60000 },
  requiresConfirmation: true,
  execute: async (params: unknown, context: AgentContext): Promise<ToolResult> => {
    const validated = shellExecSchema.parse(params);
    const startTime = Date.now();
    
    // Security validation
    const safetyCheck = validateCommand(validated.command);
    if (!safetyCheck.allowed) {
      return {
        success: false,
        error: safetyCheck.reason || 'Command blocked by security policy',
        metadata: { blockedBy: safetyCheck.blockedBy },
      };
    }
    
    console.log('[shell.exec] Executing command:', sanitizeForLogging(validated.command));
    
    try {
      // Call Swiss sandbox API via edge function for security
      const { data, error } = await supabase.functions.invoke('agent-execute', {
        body: {
          task_type: 'shell',
          code: validated.command,
          language: 'bash',
          task_id: context.taskId,
          user_id: context.userId,
          working_dir: validated.workingDir || context.workspacePath || '/home/sandbox',
          timeout_seconds: Math.floor((validated.timeout || 30000) / 1000),
          env: validated.env || {},
        },
      });
      
      const durationMs = Date.now() - startTime;
      
      if (error) {
        console.error('[shell.exec] Edge function error:', error);
        return {
          success: false,
          error: error.message || 'Failed to execute command',
          durationMs,
        };
      }
      
      // Parse response
      const result = data?.result || data;
      
      return {
        success: result?.success !== false,
        output: {
          stdout: result?.output || result?.stdout || '',
          stderr: result?.stderr || '',
          exitCode: result?.exit_code ?? result?.exitCode ?? 0,
        },
        durationMs,
        metadata: {
          command: sanitizeForLogging(validated.command),
          workingDir: validated.workingDir || context.workspacePath,
          region: 'ch-gva-2',
        },
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      console.error('[shell.exec] Execution error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown execution error',
        durationMs,
      };
    }
  },
};

// shell.view - View command output history
export const shellView: Tool = {
  name: 'shell.view',
  description: 'View the history of recently executed shell commands and their outputs.',
  category: 'shell',
  schema: shellViewSchema,
  safety: 'safe',
  rateLimit: { requests: 30, windowMs: 60000 },
  requiresConfirmation: false,
  execute: async (params: unknown, context: AgentContext): Promise<ToolResult> => {
    const validated = shellViewSchema.parse(params);
    
    console.log('[shell.view] Fetching command history, limit:', validated.limit);
    
    try {
      // Fetch from agent_tool_executions table
      const { data, error } = await supabase
        .from('agent_tool_executions')
        .select('*')
        .eq('tool_name', 'shell.exec')
        .eq('user_id', context.userId)
        .order('created_at', { ascending: false })
        .limit(validated.limit || 10);
      
      if (error) {
        console.error('[shell.view] Query error:', error);
        return {
          success: false,
          error: error.message,
        };
      }
      
      const commands = (data || []).map((row) => ({
        id: row.id,
        command: (row.input_params as Record<string, unknown>)?.command,
        output: row.output_result,
        success: row.status === 'success',
        executionTime: row.execution_time_ms,
        createdAt: row.created_at,
      }));
      
      return {
        success: true,
        output: {
          commands,
          total: commands.length,
        },
        metadata: {
          sessionId: validated.sessionId || context.sessionId,
        },
      };
    } catch (err) {
      console.error('[shell.view] Error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch command history',
      };
    }
  },
};
