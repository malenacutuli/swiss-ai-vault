import type { Tool, AgentContext, ToolResult } from '../types';
import { fileReadSchema, fileWriteSchema, fileEditSchema, fileDeleteSchema } from '../schemas/file';
import { validatePath, sanitizeForLogging } from '../safety';
import { supabase } from '@/integrations/supabase/client';

// file.read - Read file contents
export const fileRead: Tool = {
  name: 'file.read',
  description: 'Read the contents of a file from the workspace. Supports reading specific line ranges.',
  category: 'file',
  schema: fileReadSchema,
  safety: 'safe',
  rateLimit: { requests: 50, windowMs: 60000 },
  requiresConfirmation: false,
  execute: async (params: unknown, context: AgentContext): Promise<ToolResult> => {
    const validated = fileReadSchema.parse(params);
    const startTime = Date.now();
    
    // Security validation
    const safetyCheck = validatePath(validated.path);
    if (!safetyCheck.allowed) {
      return {
        success: false,
        error: safetyCheck.reason || 'Path access blocked by security policy',
        metadata: { blockedBy: safetyCheck.blockedBy },
      };
    }
    
    console.log('[file.read] Reading file:', validated.path);
    
    try {
      // Call edge function for file operations
      const { data, error } = await supabase.functions.invoke('agent-execute', {
        body: {
          task_type: 'file_read',
          file_path: validated.path,
          task_id: context.taskId,
          user_id: context.userId,
          encoding: validated.encoding || 'utf8',
          start_line: validated.startLine,
          end_line: validated.endLine,
        },
      });
      
      const durationMs = Date.now() - startTime;
      
      if (error) {
        return {
          success: false,
          error: error.message,
          durationMs,
        };
      }
      
      return {
        success: true,
        output: {
          path: validated.path,
          content: data?.content || '',
          lines: validated.startLine && validated.endLine 
            ? `${validated.startLine}-${validated.endLine}` 
            : 'all',
          size: data?.size || 0,
          encoding: validated.encoding || 'utf8',
        },
        durationMs,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to read file',
        durationMs: Date.now() - startTime,
      };
    }
  },
};

// file.write - Write/create file
export const fileWrite: Tool = {
  name: 'file.write',
  description: 'Write content to a file, creating it if it does not exist. Can create parent directories.',
  category: 'file',
  schema: fileWriteSchema,
  safety: 'moderate',
  rateLimit: { requests: 30, windowMs: 60000 },
  requiresConfirmation: false,
  execute: async (params: unknown, context: AgentContext): Promise<ToolResult> => {
    const validated = fileWriteSchema.parse(params);
    const startTime = Date.now();
    
    // Security validation
    const safetyCheck = validatePath(validated.path);
    if (!safetyCheck.allowed) {
      return {
        success: false,
        error: safetyCheck.reason || 'Path access blocked by security policy',
        metadata: { blockedBy: safetyCheck.blockedBy },
      };
    }
    
    console.log('[file.write] Writing file:', validated.path, 'size:', validated.content.length);
    
    try {
      const { data, error } = await supabase.functions.invoke('agent-execute', {
        body: {
          task_type: 'file_write',
          file_path: validated.path,
          content: validated.content,
          task_id: context.taskId,
          user_id: context.userId,
          encoding: validated.encoding || 'utf8',
          create_dirs: validated.createDirs ?? true,
          overwrite: validated.overwrite ?? true,
        },
      });
      
      const durationMs = Date.now() - startTime;
      
      if (error) {
        return {
          success: false,
          error: error.message,
          durationMs,
        };
      }
      
      // Record file action
      await supabase.from('agent_file_actions').insert({
        action_type: 'write',
        file_path: validated.path,
        step_id: null, // Will be set by caller if available
        metadata: {
          bytesWritten: validated.content.length,
          encoding: validated.encoding || 'utf8',
        },
      });
      
      return {
        success: true,
        output: {
          path: validated.path,
          bytesWritten: validated.content.length,
          created: data?.created ?? true,
        },
        durationMs,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to write file',
        durationMs: Date.now() - startTime,
      };
    }
  },
};

// file.edit - Edit existing file with diff
export const fileEdit: Tool = {
  name: 'file.edit',
  description: 'Edit an existing file by applying line-based changes. Supports multiple edits and dry-run mode.',
  category: 'file',
  schema: fileEditSchema,
  safety: 'moderate',
  rateLimit: { requests: 30, windowMs: 60000 },
  requiresConfirmation: false,
  execute: async (params: unknown, context: AgentContext): Promise<ToolResult> => {
    const validated = fileEditSchema.parse(params);
    const startTime = Date.now();
    
    // Security validation
    const safetyCheck = validatePath(validated.path);
    if (!safetyCheck.allowed) {
      return {
        success: false,
        error: safetyCheck.reason || 'Path access blocked by security policy',
        metadata: { blockedBy: safetyCheck.blockedBy },
      };
    }
    
    console.log('[file.edit] Editing file:', validated.path, 'edits:', validated.edits.length);
    
    try {
      const { data, error } = await supabase.functions.invoke('agent-execute', {
        body: {
          task_type: 'file_edit',
          file_path: validated.path,
          edits: validated.edits,
          task_id: context.taskId,
          user_id: context.userId,
          dry_run: validated.dryRun ?? false,
        },
      });
      
      const durationMs = Date.now() - startTime;
      
      if (error) {
        return {
          success: false,
          error: error.message,
          durationMs,
        };
      }
      
      // Record file action if not dry run
      if (!validated.dryRun) {
        await supabase.from('agent_file_actions').insert({
          action_type: 'edit',
          file_path: validated.path,
          metadata: {
            editsApplied: validated.edits.length,
          },
        });
      }
      
      return {
        success: true,
        output: {
          path: validated.path,
          editsApplied: validated.edits.length,
          dryRun: validated.dryRun,
          diff: data?.diff,
        },
        durationMs,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to edit file',
        durationMs: Date.now() - startTime,
      };
    }
  },
};

// file.delete - Delete file
export const fileDelete: Tool = {
  name: 'file.delete',
  description: 'Delete a file or directory from the workspace. Use with caution.',
  category: 'file',
  schema: fileDeleteSchema,
  safety: 'dangerous',
  rateLimit: { requests: 10, windowMs: 60000 },
  requiresConfirmation: true,
  execute: async (params: unknown, context: AgentContext): Promise<ToolResult> => {
    const validated = fileDeleteSchema.parse(params);
    const startTime = Date.now();
    
    // Security validation
    const safetyCheck = validatePath(validated.path);
    if (!safetyCheck.allowed) {
      return {
        success: false,
        error: safetyCheck.reason || 'Path access blocked by security policy',
        metadata: { blockedBy: safetyCheck.blockedBy },
      };
    }
    
    console.log('[file.delete] Deleting:', validated.path, 'recursive:', validated.recursive);
    
    try {
      const { data, error } = await supabase.functions.invoke('agent-execute', {
        body: {
          task_type: 'file_delete',
          file_path: validated.path,
          task_id: context.taskId,
          user_id: context.userId,
          recursive: validated.recursive ?? false,
          force: validated.force ?? false,
        },
      });
      
      const durationMs = Date.now() - startTime;
      
      if (error) {
        return {
          success: false,
          error: error.message,
          durationMs,
        };
      }
      
      // Record file action
      await supabase.from('agent_file_actions').insert({
        action_type: 'delete',
        file_path: validated.path,
        metadata: {
          recursive: validated.recursive,
        },
      });
      
      return {
        success: true,
        output: {
          path: validated.path,
          deleted: true,
          filesRemoved: data?.filesRemoved || 1,
        },
        durationMs,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to delete file',
        durationMs: Date.now() - startTime,
      };
    }
  },
};
