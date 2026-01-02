import { useCallback } from 'react';
import { useMemory } from './useMemory';
import { useEncryptionContext } from '@/contexts/EncryptionContext';
import * as vault from '@/lib/crypto/key-vault';

export interface MemoryContextResult {
  context: string | null;
  sources: Array<{
    id: string;
    title: string;
    content: string;
    score: number;
    type: string;
  }>;
}

/**
 * Unified hook for memory context across all SwissVault features.
 * Provides consistent memory search and context injection for:
 * - Ghost Chat
 * - Vault Chat
 * - Discovery modules (Finance, Legal, Patents, etc.)
 * - Any new chat or conversation features
 */
export function useMemoryContext() {
  const memory = useMemory();
  const { isUnlocked } = useEncryptionContext();
  const isVaultUnlocked = vault.isVaultUnlocked() || isUnlocked;
  
  const isReady = memory.isReady && isVaultUnlocked;

  /**
   * Search memory and format results as context for AI
   */
  const getMemoryContext = useCallback(async (
    query: string,
    options?: {
      limit?: number;
      sources?: string[];
      minScore?: number;
      domain?: string; // For domain-specific searches (finance, legal, etc.)
    }
  ): Promise<MemoryContextResult> => {
    if (!isReady || !memory.isInitialized) {
      return { context: null, sources: [] };
    }

    try {
      // Enhance query with domain keywords if specified
      let searchQuery = query;
      if (options?.domain) {
        const domainKeywords: Record<string, string> = {
          finance: 'finance investment portfolio trading stocks crypto',
          legal: 'legal law contract regulation compliance',
          patents: 'patent intellectual property innovation invention',
          research: 'research academic study analysis',
          security: 'security cybersecurity threat vulnerability',
          health: 'health medical healthcare wellness',
          travel: 'travel destination booking itinerary',
          realestate: 'real estate property housing mortgage',
          art: 'art creative design aesthetic',
          vc: 'venture capital startup funding investment',
        };
        const keywords = domainKeywords[options.domain] || '';
        searchQuery = `${query} ${keywords}`.trim();
      }

      const results = await memory.search(searchQuery, {
        topK: options?.limit || 5,
      });

      if (!results || results.length === 0) {
        return { context: null, sources: [] };
      }

      // Filter by source if specified
      let filtered = results;
      if (options?.sources && options.sources.length > 0) {
        filtered = results.filter(r => options.sources!.includes(r.source || 'unknown'));
      }

      // Filter by score if specified
      if (options?.minScore) {
        filtered = filtered.filter(r => (r.score || 1) >= options.minScore!);
      }

      if (filtered.length === 0) {
        return { context: null, sources: [] };
      }

      // Build context string
      const contextParts = filtered.map((r, i) => {
        const sourceLabel = r.source?.toUpperCase() || 'MEMORY';
        const title = r.metadata?.title || r.metadata?.filename || `Memory ${i + 1}`;
        const score = Math.round((r.score || 0) * 100);
        return `[${i + 1}. ${sourceLabel} - ${title} (${score}% relevant)]\n${r.content.slice(0, 400)}`;
      });

      const context = `[CONTEXT FROM YOUR PERSONAL MEMORY]
The following information was retrieved from your stored documents, notes, and conversations:

${contextParts.join('\n\n---\n\n')}

[END CONTEXT]

Use this context to inform your response when relevant. Cite sources by number when directly using information.`;

      const sources = filtered.map((r, i) => ({
        id: r.id || `memory-${i}`,
        title: r.metadata?.title || r.metadata?.filename || `Memory ${i + 1}`,
        content: r.content,
        score: r.score || 0,
        type: r.source || 'document',
      }));

      return { context, sources };
    } catch (error) {
      console.error('[useMemoryContext] Search failed:', error);
      return { context: null, sources: [] };
    }
  }, [isReady, memory]);

  /**
   * Build messages array with memory context prepended as a system message
   */
  const withMemoryContext = useCallback(async (
    messages: Array<{ role: string; content: string }>,
    query: string,
    options?: {
      limit?: number;
      domain?: string;
    }
  ): Promise<{
    messages: Array<{ role: string; content: string }>;
    sources: MemoryContextResult['sources'];
  }> => {
    const result = await getMemoryContext(query, options);

    if (!result.context) {
      return { messages, sources: [] };
    }

    return {
      messages: [
        {
          role: 'system',
          content: `RELEVANT CONTEXT FROM USER'S MEMORY:\n\n${result.context}\n\n---\nUse this context to provide more personalized and relevant responses.`,
        },
        ...messages,
      ],
      sources: result.sources,
    };
  }, [getMemoryContext]);

  /**
   * Get a system prompt enhancement with memory context
   */
  const getSystemPromptWithMemory = useCallback(async (
    basePrompt: string,
    query: string,
    domain?: string
  ): Promise<{ prompt: string; sources: MemoryContextResult['sources'] }> => {
    const result = await getMemoryContext(query, { domain, limit: 3 });

    if (!result.context) {
      return { prompt: basePrompt, sources: [] };
    }

    return {
      prompt: `${basePrompt}

${result.context}`,
      sources: result.sources,
    };
  }, [getMemoryContext]);

  return {
    getMemoryContext,
    withMemoryContext,
    getSystemPromptWithMemory,
    isReady,
    isInitialized: memory.isInitialized,
    initialize: memory.initialize,
  };
}
