// src/hooks/useGroundedChat.ts
// Hook for grounded (citation-backed) chat with local memory search

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMemory } from '@/hooks/useMemory';
import { useToast } from '@/hooks/use-toast';
import type { 
  GroundedResponse, 
  SourceDocument, 
  GroundedChatMessage,
  Citation 
} from '@/types/grounded';

interface UseGroundedChatOptions {
  maxSources?: number;
  model?: string;
  projectId?: string;
}

export function useGroundedChat(options: UseGroundedChatOptions = {}) {
  const { toast } = useToast();
  const memory = useMemory();
  const { maxSources = 5, model = 'gpt-4o-mini', projectId } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<GroundedChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (query: string): Promise<GroundedResponse | null> => {
    if (!query.trim()) return null;

    setIsLoading(true);
    setError(null);

    // Add user message
    const userMessage: GroundedChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: query,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      // 1. Search local memory for relevant documents
      const searchResults = await memory.search(query, { topK: maxSources });

      if (!searchResults || searchResults.length === 0) {
        const noDocsMessage: GroundedChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: "I don't have any documents in memory to answer this question. Please add some documents first, or try a different query.",
          isGrounded: false,
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, noDocsMessage]);
        setIsLoading(false);
        return null;
      }

      // 2. Prepare sources for grounded inference
      const sources: SourceDocument[] = searchResults.map(item => {
        const metadata = item.metadata as Record<string, unknown>;
        const isVoiceNote = metadata?.isVoiceNote === true;
        
        return {
          id: item.id,
          title: (metadata?.title || metadata?.filename || 'Document') as string,
          content: item.content.substring(0, 2000), // Limit content length
          similarity: item.score || 0,
          type: isVoiceNote ? 'voice_note' : (item.source as SourceDocument['type']) || 'memory',
        };
      });

      // 3. Build grounded prompt
      const systemPrompt = buildGroundedSystemPrompt(sources);
      
      // 4. Call inference with grounded context
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('ghost-inference', {
        body: {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: query },
          ],
          model,
          temperature: 0.3, // Lower temperature for factual responses
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Grounded inference failed');
      }

      const assistantContent = response.data?.content || response.data?.choices?.[0]?.message?.content || '';
      
      // 5. Parse citations from response
      const { content: cleanContent, citations } = parseCitations(assistantContent, sources);

      const groundedResponse: GroundedResponse = {
        content: cleanContent,
        citations,
        sources,
        isGrounded: citations.length > 0,
        sourceCount: sources.length,
      };

      // 6. Add assistant message with citations
      const assistantMessage: GroundedChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: groundedResponse.content,
        citations: groundedResponse.citations,
        sources: groundedResponse.sources,
        isGrounded: groundedResponse.isGrounded,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMessage]);

      return groundedResponse;

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[useGroundedChat] Error:', err);
      setError(errorMessage);
      
      toast({
        title: 'Grounded Chat Error',
        description: errorMessage,
        variant: 'destructive',
      });

      // Add error message
      const errorMsg: GroundedChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errorMessage}`,
        isGrounded: false,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);

      return null;
    } finally {
      setIsLoading(false);
    }
  }, [maxSources, model, memory, toast]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    isReady: memory.isReady,
  };
}

/**
 * Build a system prompt that instructs the model to use sources and cite them
 */
function buildGroundedSystemPrompt(sources: SourceDocument[]): string {
  const sourceList = sources.map((s, i) => 
    `[${i + 1}] ${s.title} (${s.type}):\n${s.content}`
  ).join('\n\n---\n\n');

  return `You are a helpful assistant that answers questions based ONLY on the provided sources.

INSTRUCTIONS:
1. Answer the user's question using ONLY the information from the sources below
2. Cite sources using [1], [2], etc. inline when you use information from them
3. If the sources don't contain enough information to answer, say so clearly
4. Do not make up or infer information not present in the sources
5. Be concise and factual

SOURCES:
${sourceList}

Remember: Only use information from these sources. Always cite your sources inline.`;
}

/**
 * Parse citation markers like [1], [2] from the response and create Citation objects
 */
function parseCitations(
  content: string, 
  sources: SourceDocument[]
): { content: string; citations: Citation[] } {
  const citations: Citation[] = [];
  const citationPattern = /\[(\d+)\]/g;
  
  let match;
  const seenIndices = new Set<number>();
  
  while ((match = citationPattern.exec(content)) !== null) {
    const sourceIndex = parseInt(match[1], 10) - 1; // Convert to 0-indexed
    
    if (sourceIndex >= 0 && sourceIndex < sources.length && !seenIndices.has(sourceIndex)) {
      seenIndices.add(sourceIndex);
      citations.push({
        sourceIndex,
        sourceId: sources[sourceIndex].id,
        text: match[0],
        startOffset: match.index,
        endOffset: match.index + match[0].length,
      });
    }
  }
  
  return { content, citations };
}
