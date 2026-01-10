import type { Tool, AgentContext, ToolResult } from '../types';
import { searchWebSchema, searchCodeSchema } from '../schemas/search';
import { supabase } from '@/integrations/supabase/client';

// search.web - Search the web via AI
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
    const startTime = Date.now();
    
    console.log('[search.web] Searching:', validated.query);
    
    try {
      const { data, error } = await supabase.functions.invoke('agent-execute', {
        body: {
          task_type: 'search_web',
          query: validated.query,
          task_id: context.taskId,
          user_id: context.userId,
          max_results: validated.maxResults || 10,
          search_type: validated.searchType || 'general',
          time_range: validated.timeRange || 'any',
          language: validated.language || 'en',
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
      
      const results = data?.results || [];
      
      // Store sources for citation
      if (results.length > 0) {
        const sources = results.slice(0, 5).map((r: { title: string; url: string; snippet: string }, i: number) => ({
          task_id: context.taskId,
          source_type: 'web',
          source_title: r.title,
          source_url: r.url,
          source_snippet: r.snippet,
          citation_key: `[${i + 1}]`,
          relevance_score: 1 - (i * 0.1),
        }));
        
        await supabase.from('agent_sources').insert(sources);
      }
      
      return {
        success: true,
        output: {
          query: validated.query,
          results: results.map((r: { title: string; url: string; snippet: string }) => ({
            title: r.title,
            url: r.url,
            snippet: r.snippet,
          })),
          totalResults: results.length,
        },
        durationMs,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Web search failed',
        durationMs: Date.now() - startTime,
      };
    }
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
    const startTime = Date.now();
    
    console.log('[search.code] Searching codebase:', validated.query);
    
    try {
      const { data, error } = await supabase.functions.invoke('agent-execute', {
        body: {
          task_type: 'search_code',
          query: validated.query,
          task_id: context.taskId,
          user_id: context.userId,
          path: validated.path || context.workspacePath,
          file_types: validated.fileTypes,
          case_sensitive: validated.caseSensitive || false,
          regex: validated.regex || false,
          max_results: validated.maxResults || 20,
          include_context: validated.includeContext ?? true,
          context_lines: validated.contextLines || 3,
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
      
      const matches = data?.matches || [];
      
      return {
        success: true,
        output: {
          query: validated.query,
          matches: matches.map((m: { file: string; line: number; content: string; context: string[] }) => ({
            file: m.file,
            line: m.line,
            content: m.content,
            context: m.context,
          })),
          totalMatches: matches.length,
          searchPath: validated.path || context.workspacePath,
        },
        durationMs,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Code search failed',
        durationMs: Date.now() - startTime,
      };
    }
  },
};
