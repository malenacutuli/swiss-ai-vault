import { z } from 'zod';

// search.web - Search the web via Gemini
export const searchWebSchema = z.object({
  query: z.string().min(1).max(500).describe('Search query'),
  maxResults: z.number().min(1).max(20).optional().default(10).describe('Maximum number of results'),
  searchType: z.enum(['general', 'news', 'images', 'academic']).optional().default('general').describe('Type of search'),
  timeRange: z.enum(['any', 'day', 'week', 'month', 'year']).optional().default('any').describe('Time range filter'),
  language: z.string().max(10).optional().default('en').describe('Search language code'),
});

export type SearchWebParams = z.infer<typeof searchWebSchema>;

// search.code - Search codebase
export const searchCodeSchema = z.object({
  query: z.string().min(1).max(500).describe('Search query or pattern'),
  path: z.string().max(500).optional().describe('Path prefix to search within'),
  fileTypes: z.array(z.string().max(20)).max(10).optional().describe('File extensions to include (e.g., [".ts", ".tsx"])'),
  caseSensitive: z.boolean().optional().default(false).describe('Case-sensitive search'),
  regex: z.boolean().optional().default(false).describe('Treat query as regular expression'),
  maxResults: z.number().min(1).max(100).optional().default(20).describe('Maximum number of results'),
  includeContext: z.boolean().optional().default(true).describe('Include surrounding lines for context'),
  contextLines: z.number().min(0).max(10).optional().default(3).describe('Number of context lines'),
});

export type SearchCodeParams = z.infer<typeof searchCodeSchema>;
