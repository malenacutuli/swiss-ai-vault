// src/lib/agents/core/logger.ts
// Logging utilities for Swiss Agents

import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export type LogType = 'info' | 'error' | 'warning' | 'progress' | 'command' | 'output' | 'debug';

let sequenceCounter = 0;

export async function streamLog(
  taskId: string,
  logType: LogType,
  content: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  sequenceCounter++;
  
  try {
    await supabase.from('agent_task_logs').insert({
      task_id: taskId,
      log_type: logType,
      content,
      sequence_number: sequenceCounter,
      metadata: (metadata ?? null) as Json,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Failed to stream log:', err);
  }
}

export function createLogger(taskId: string) {
  return {
    info: (message: string, metadata?: Record<string, unknown>) => 
      streamLog(taskId, 'info', message, metadata),
    
    error: (message: string, metadata?: Record<string, unknown>) => 
      streamLog(taskId, 'error', message, metadata),
    
    warning: (message: string, metadata?: Record<string, unknown>) => 
      streamLog(taskId, 'warning', message, metadata),
    
    progress: (message: string, metadata?: Record<string, unknown>) => 
      streamLog(taskId, 'progress', message, metadata),
    
    command: (command: string, metadata?: Record<string, unknown>) => 
      streamLog(taskId, 'command', command, metadata),
    
    output: (output: string, metadata?: Record<string, unknown>) => 
      streamLog(taskId, 'output', output, metadata),
    
    debug: (message: string, metadata?: Record<string, unknown>) => 
      streamLog(taskId, 'debug', message, metadata),
  };
}

export function resetSequence(): void {
  sequenceCounter = 0;
}
