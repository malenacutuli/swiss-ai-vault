import { z } from 'zod';

// file.read - Read file contents
export const fileReadSchema = z.object({
  path: z.string().min(1).max(1000).describe('Path to the file to read'),
  encoding: z.enum(['utf8', 'base64', 'binary']).optional().default('utf8').describe('File encoding'),
  startLine: z.number().min(1).optional().describe('Start reading from this line (1-indexed)'),
  endLine: z.number().min(1).optional().describe('Stop reading at this line (1-indexed)'),
});

export type FileReadParams = z.infer<typeof fileReadSchema>;

// file.write - Write/create file
export const fileWriteSchema = z.object({
  path: z.string().min(1).max(1000).describe('Path to the file to write'),
  content: z.string().max(1000000).describe('Content to write to the file'),
  encoding: z.enum(['utf8', 'base64']).optional().default('utf8').describe('File encoding'),
  createDirs: z.boolean().optional().default(true).describe('Create parent directories if they do not exist'),
  overwrite: z.boolean().optional().default(true).describe('Overwrite existing file'),
});

export type FileWriteParams = z.infer<typeof fileWriteSchema>;

// file.edit - Edit existing file with diff
export const fileEditSchema = z.object({
  path: z.string().min(1).max(1000).describe('Path to the file to edit'),
  edits: z.array(z.object({
    startLine: z.number().min(1).describe('Start line of the edit (1-indexed)'),
    endLine: z.number().min(1).describe('End line of the edit (1-indexed)'),
    newContent: z.string().describe('New content to replace the specified lines'),
  })).min(1).max(50).describe('List of edits to apply'),
  dryRun: z.boolean().optional().default(false).describe('Preview changes without applying'),
});

export type FileEditParams = z.infer<typeof fileEditSchema>;

// file.delete - Delete file
export const fileDeleteSchema = z.object({
  path: z.string().min(1).max(1000).describe('Path to the file to delete'),
  recursive: z.boolean().optional().default(false).describe('Delete directories recursively'),
  force: z.boolean().optional().default(false).describe('Force deletion without confirmation'),
});

export type FileDeleteParams = z.infer<typeof fileDeleteSchema>;
