import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UploadedDocument {
  filename: string;
  chunkCount: number;
  uploadedAt: Date;
}

interface DocumentChunk {
  id: string;
  content: string;
  filename: string;
  chunk_index: number;
  similarity: number;
}

const SUPPORTED_FILE_TYPES = ['txt', 'md', 'pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function useRAGContext() {
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const hasContext = useMemo(() => uploadedDocuments.length > 0, [uploadedDocuments]);

  const uploadDocument = useCallback(async (file: File): Promise<{ success: boolean; chunkCount: number }> => {
    // Validate file type
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !SUPPORTED_FILE_TYPES.includes(extension)) {
      toast.error(`Unsupported file type. Supported: ${SUPPORTED_FILE_TYPES.join(', ')}`);
      return { success: false, chunkCount: 0 };
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File too large. Maximum size is 10MB.');
      return { success: false, chunkCount: 0 };
    }

    setIsUploading(true);
    const loadingToast = toast.loading(`Processing ${file.name}...`);

    try {
      // Generate conversation ID on first upload
      let currentConversationId = conversationId;
      if (!currentConversationId) {
        currentConversationId = crypto.randomUUID();
        setConversationId(currentConversationId);
      }

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.dismiss(loadingToast);
        toast.error('You must be logged in to upload documents');
        return { success: false, chunkCount: 0 };
      }

      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('conversation_id', currentConversationId);

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
        throw new Error(error.error || 'Failed to process document');
      }

      const result = await response.json();

      // Add to uploaded documents
      setUploadedDocuments(prev => [...prev, {
        filename: file.name,
        chunkCount: result.chunks_created,
        uploadedAt: new Date(),
      }]);

      toast.dismiss(loadingToast);
      toast.success(`${file.name} processed: ${result.chunks_created} chunks created`);

      return { success: true, chunkCount: result.chunks_created };
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.dismiss(loadingToast);
      toast.error(error instanceof Error ? error.message : 'Failed to upload document');
      return { success: false, chunkCount: 0 };
    } finally {
      setIsUploading(false);
    }
  }, [conversationId]);

  const searchContext = useCallback(async (query: string, limit: number = 5): Promise<DocumentChunk[]> => {
    if (!conversationId) {
      return [];
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('No session for context search');
        return [];
      }

      // Generate embedding for the query using OpenAI via our endpoint
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-ada-002',
          input: query,
        }),
      });

      if (!embeddingResponse.ok) {
        // Fallback: try using a simple keyword search if embedding fails
        console.warn('Embedding generation failed, using fallback search');
        const { data, error } = await supabase
          .from('document_chunks')
          .select('id, content, filename, chunk_index')
          .eq('conversation_id', conversationId)
          .textSearch('content', query.split(' ').join(' & '))
          .limit(limit);

        if (error) throw error;
        return (data || []).map(chunk => ({ ...chunk, similarity: 0.5 }));
      }

      const embeddingData = await embeddingResponse.json();
      const queryEmbedding = embeddingData.data[0].embedding;

      // Call search function
      const { data, error } = await supabase.rpc('search_document_chunks', {
        p_user_id: session.user.id,
        p_embedding: JSON.stringify(queryEmbedding),
        p_match_count: limit,
        p_conversation_id: conversationId,
        p_match_threshold: 0.7,
      });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error searching context:', error);
      return [];
    }
  }, [conversationId]);

  const clearContext = useCallback(async (): Promise<void> => {
    if (!conversationId) {
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
        p_conversation_id: conversationId,
      });

      if (error) {
        // Try direct delete as fallback
        await supabase
          .from('document_chunks')
          .delete()
          .eq('conversation_id', conversationId);
      }

      setUploadedDocuments([]);
      setConversationId(null);
      toast.success('Context cleared');
    } catch (error) {
      console.error('Error clearing context:', error);
      toast.error('Failed to clear context');
    }
  }, [conversationId]);

  const getContextPrompt = useCallback((chunks: DocumentChunk[]): string => {
    if (chunks.length === 0) {
      return '';
    }

    const contextParts = chunks.map(chunk => 
      `[Document: ${chunk.filename}]\n${chunk.content}`
    );

    return `Context from uploaded documents:\n\n${contextParts.join('\n\n')}\n\n---\nUse the above context to answer the user's question.`;
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
  };
}
