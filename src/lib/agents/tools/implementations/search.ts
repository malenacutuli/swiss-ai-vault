import type { Tool, AgentContext, ToolResult } from '../types';
import { searchWebSchema, searchCodeSchema } from '../schemas/search';

// search.web - Search the web via Gemini
export const searchWeb: Tool = {
  name: 'search.web',
  description: 'Search the web using AI-powered search. Returns relevant results with snippets.',
  category: 'search',
  schema: searchWebSchema,
  safety: 'safe',
  rateLimit: { requests: 20, windowMs: 60000 },
  requiresConfirmation: false,
  execute: async (params: unknown, context: AgentContext): Promise<ToolResult> => {
    const validated = searchWebSchema.parse(params);
    
    console.log('[search.web] Searching:', validated.query);
    
    return {
      success: true,
      output: {
        query: validated.query,
        results: [
          {
            title: `[Simulated] Result for "${validated.query}"`,
            url: 'https://example.com',
            snippet: 'This is a simulated search result.',
          },
        ],
        totalResults: 1,
      },
    };
  },
};

// search.code - Search codebase
export const searchCode: Tool = {
  name: 'search.code',
  description: 'Search the project codebase for patterns, functions, or text. Supports regex.',
  category: 'search',
  schema: searchCodeSchema,
  safety: 'safe',
  rateLimit: { requests: 30, windowMs: 60000 },
  requiresConfirmation: false,
  execute: async (params: unknown, context: AgentContext): Promise<ToolResult> => {
    const validated = searchCodeSchema.parse(params);
    
    console.log('[search.code] Searching codebase:', validated.query);
    
    return {
      success: true,
      output: {
        query: validated.query,
        matches: [],
        totalMatches: 0,
        searchPath: validated.path || context.workspacePath,
      },
    };
  },
};
