import type { Tool, AgentContext, ToolResult } from '../types';
import { fileReadSchema, fileWriteSchema, fileEditSchema, fileDeleteSchema } from '../schemas/file';

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
    
    console.log('[file.read] Reading file:', validated.path);
    
    return {
      success: true,
      output: {
        path: validated.path,
        content: `[Simulated] Contents of ${validated.path}`,
        lines: validated.startLine && validated.endLine 
          ? `${validated.startLine}-${validated.endLine}` 
          : 'all',
      },
    };
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
    
    console.log('[file.write] Writing file:', validated.path, 'size:', validated.content.length);
    
    return {
      success: true,
      output: {
        path: validated.path,
        bytesWritten: validated.content.length,
        created: true,
      },
    };
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
    
    console.log('[file.edit] Editing file:', validated.path, 'edits:', validated.edits.length);
    
    return {
      success: true,
      output: {
        path: validated.path,
        editsApplied: validated.edits.length,
        dryRun: validated.dryRun,
      },
    };
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
    
    console.log('[file.delete] Deleting:', validated.path, 'recursive:', validated.recursive);
    
    return {
      success: true,
      output: {
        path: validated.path,
        deleted: true,
      },
    };
  },
};
