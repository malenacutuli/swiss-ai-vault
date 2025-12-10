import { useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  getFileConfig, 
  isFileSupported, 
  getSupportedExtensions,
  type FileHandler 
} from '@/lib/supported-file-types';

export type ProcessingStage = 'uploading' | 'extracting' | 'embedding' | 'complete' | 'error';

interface UploadedDocument {
  filename: string;
  chunkCount: number;
  uploadedAt: Date;
  handler?: FileHandler;
}

interface DocumentChunk {
  id: string;
  content: string;
  filename: string;
  chunkIndex: number;
  similarity?: number;
  metadata?: Record<string, any>;
}

// Verify Supabase URL is available for Edge Function calls
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
if (!SUPABASE_URL) {
  console.warn('[RAG] VITE_SUPABASE_URL not configured - RAG search will not work');
}

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

export function useRAGContext(externalConversationId?: string | null) {
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(externalConversationId || null);
  const [contextEnabled, setContextEnabled] = useState(true);

  // Sync with external conversation ID
  useEffect(() => {
    if (externalConversationId !== undefined) {
      setConversationId(externalConversationId);
      // Clear documents when conversation changes
      if (externalConversationId !== conversationId) {
        setUploadedDocuments([]);
      }
    }
  }, [externalConversationId]);

  const hasContext = useMemo(() => uploadedDocuments.length > 0, [uploadedDocuments]);

  const uploadDocument = useCallback(async (
    file: File, 
    onStageChange?: (stage: ProcessingStage, progress: number) => void
  ): Promise<{ success: boolean; chunkCount: number }> => {
    // Use external conversation ID if provided
    const targetConversationId = conversationId || externalConversationId;
    
    if (!targetConversationId) {
      toast.error('Please select or create a conversation first');
      return { success: false, chunkCount: 0 };
    }

    // Validate file type
    const fileConfig = getFileConfig(file);
    if (!fileConfig) {
      const supported = getSupportedExtensions().slice(0, 10).join(', ') + '...';
      toast.error(`Unsupported file type. Supported: ${supported}`);
      return { success: false, chunkCount: 0 };
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File too large. Maximum size is 500MB.');
      return { success: false, chunkCount: 0 };
    }

    setIsUploading(true);
    
    // Stage: Extracting text
    onStageChange?.('extracting', 40);

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('You must be logged in to upload documents');
        onStageChange?.('error', 0);
        return { success: false, chunkCount: 0 };
      }

      // Create form data with handler info
      const formData = new FormData();
      formData.append('file', file);
      formData.append('conversation_id', targetConversationId);
      formData.append('handler', fileConfig.handler);

      // Stage: Embedding (the Edge Function handles both extraction and embedding)
      onStageChange?.('embedding', 60);

      // Call embed-document Edge Function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/embed-document`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Upload failed' }));
        onStageChange?.('error', 0);
        throw new Error(error.error || 'Failed to process document');
      }

      const result = await response.json();

      // Stage: Complete
      onStageChange?.('complete', 100);

      // Add to uploaded documents
      setUploadedDocuments(prev => [...prev, {
        filename: file.name,
        chunkCount: result.chunks_created,
        uploadedAt: new Date(),
        handler: fileConfig.handler,
      }]);

      toast.success(`${file.name} processed: ${result.chunks_created} chunks created`);

      return { success: true, chunkCount: result.chunks_created };
    } catch (error) {
      console.error('Error uploading document:', error);
      onStageChange?.('error', 0);
      toast.error(error instanceof Error ? error.message : 'Failed to upload document');
      return { success: false, chunkCount: 0 };
    } finally {
      setIsUploading(false);
    }
  }, [conversationId, externalConversationId]);

  const searchContext = useCallback(async (query: string, limit: number = 5): Promise<DocumentChunk[]> => {
    const targetConversationId = conversationId || externalConversationId;
    
    if (!targetConversationId || !contextEnabled) {
      console.log('[RAG] Search skipped - no conversation or context disabled');
      return [];
    }

    console.log('[RAG] Searching context for query:', query.substring(0, 100));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('[RAG] No session for context search');
        return [];
      }

      const results: DocumentChunk[] = [];

      // 1. Use semantic vector search via Edge Function
      console.log('[RAG] Calling search-documents Edge Function...');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-documents`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            conversation_id: targetConversationId,
            limit,
            match_threshold: 0.5, // Lower threshold for better recall
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('[RAG] Vector search found', data.count, 'chunks');
        
        if (data.chunks && data.chunks.length > 0) {
          results.push(...data.chunks.map((chunk: any) => ({
            id: chunk.id,
            content: chunk.content,
            filename: chunk.filename,
            chunk_index: chunk.chunk_index || 0,
            similarity: chunk.similarity || 0.7,
            metadata: { 
              source: 'document', 
              filename: chunk.filename,
            }
          })));
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('[RAG] Vector search failed:', response.status, errorData);
        
        // Fallback to text search if vector search fails
        console.log('[RAG] Falling back to text search...');
        const { data: docChunks, error: docError } = await supabase
          .from('document_chunks')
          .select('id, content, filename, chunk_index, metadata')
          .eq('conversation_id', targetConversationId)
          .limit(limit);

        if (!docError && docChunks && docChunks.length > 0) {
          console.log('[RAG] Text fallback found', docChunks.length, 'chunks');
          results.push(...docChunks.map(chunk => ({
            id: chunk.id,
            content: chunk.content,
            filename: chunk.filename,
            chunkIndex: chunk.chunk_index,
            similarity: 0.5,
            metadata: { 
              source: 'document', 
              filename: chunk.filename,
              ...(chunk.metadata as Record<string, any> || {})
            }
          })));
        }
      }

      // 2. Also search integration data if user has active integrations
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: activeIntegrations } = await supabase
          .from('chat_integrations')
          .select('id, integration_type')
          .eq('user_id', user.id)
          .eq('is_active', true);

        if (activeIntegrations && activeIntegrations.length > 0) {
          const integrationIds = activeIntegrations.map(i => i.id);
          const { data: integrationData } = await supabase
            .from('chat_integration_data')
            .select('id, snippet, title, integration_id, metadata')
            .in('integration_id', integrationIds)
            .limit(limit);

          if (integrationData) {
            const queryLower = query.toLowerCase();
            const matchingData = integrationData.filter(item => 
              (item.snippet?.toLowerCase().includes(queryLower)) ||
              (item.title?.toLowerCase().includes(queryLower))
            );

            results.push(...matchingData.map(item => {
              const integration = activeIntegrations.find(i => i.id === item.integration_id);
              return {
                id: item.id,
                content: item.snippet || item.title || '',
                filename: item.title || 'Integration Data',
                chunkIndex: 0,
                similarity: 0.6,
                metadata: {
                  source: integration?.integration_type || 'integration',
                  ...(item.metadata as Record<string, any> || {})
                }
              };
            }));
          }
        }
      }

      console.log('[RAG] Total context results:', results.length);
      return results.slice(0, limit);
    } catch (error) {
      console.error('[RAG] Error searching context:', error);
      return [];
    }
  }, [conversationId, externalConversationId, contextEnabled]);

  const clearContext = useCallback(async (): Promise<void> => {
    const targetConversationId = conversationId || externalConversationId;
    
    if (!targetConversationId) {
      setUploadedDocuments([]);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setUploadedDocuments([]);
        setConversationId(null);
        return;
      }

      // Delete all chunks for this conversation
      const { error } = await supabase.rpc('clear_conversation_documents', {
        p_user_id: session.user.id,
        p_conversation_id: targetConversationId,
      });

      if (error) {
        // Try direct delete as fallback
        await supabase
          .from('document_chunks')
          .delete()
          .eq('conversation_id', targetConversationId);
      }

      setUploadedDocuments([]);
      toast.success('Context cleared');
    } catch (error) {
      console.error('Error clearing context:', error);
      toast.error('Failed to clear context');
    }
  }, [conversationId, externalConversationId]);

  const getContextPrompt = useCallback((chunks: DocumentChunk[]): string => {
    if (chunks.length === 0) {
      return '';
    }

    const contextParts = chunks.map((chunk, i) => {
      const source = chunk.metadata?.source || 'document';
      const filename = chunk.metadata?.filename || chunk.filename;
      return `[${i + 1}. ${source.toUpperCase()}: ${filename}]\n${chunk.content}`;
    });

    return `You have access to the following documents and context:\n\n${contextParts.join('\n\n---\n\n')}\n\n---\nUse this information to answer the user's question. Cite sources using [1], [2], etc. when relevant.`;
  }, []);

  return {
    uploadedDocuments,
    isUploading,
    uploadDocument,
    searchContext,
    clearContext,
    getContextPrompt,
    hasContext,
    conversationId,
    contextEnabled,
    setContextEnabled,
  };
}
