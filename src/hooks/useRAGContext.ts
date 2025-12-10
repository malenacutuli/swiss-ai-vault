import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  getFileConfig, 
  getSupportedExtensions,
  type FileHandler 
} from '@/lib/supported-file-types';
import { useAuth } from '@/contexts/AuthContext';

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

export interface ProcessingJob {
  id: string;
  status: string;
  progress: number;
  file_name: string;
  file_size: number;
  chunks_created: number | null;
  error_message: string | null;
}

// Verify Supabase URL is available for Edge Function calls
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
if (!SUPABASE_URL) {
  console.warn('[RAG] VITE_SUPABASE_URL not configured - RAG search will not work');
}

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

export function useRAGContext(externalConversationId?: string | null) {
  const { user } = useAuth();
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(externalConversationId || null);
  const [contextEnabled, setContextEnabled] = useState(true);
  const [processingJobs, setProcessingJobs] = useState<ProcessingJob[]>([]);
  const subscriptionsRef = useRef<Map<string, ReturnType<typeof supabase.channel>>>(new Map());

  // Sync with external conversation ID
  useEffect(() => {
    if (externalConversationId !== undefined) {
      setConversationId(externalConversationId);
      // Clear documents when conversation changes
      if (externalConversationId !== conversationId) {
        setUploadedDocuments([]);
        setProcessingJobs([]);
      }
    }
  }, [externalConversationId]);

  // Cleanup subscriptions on unmount
  useEffect(() => {
    return () => {
      subscriptionsRef.current.forEach((channel) => {
        supabase.removeChannel(channel);
      });
      subscriptionsRef.current.clear();
    };
  }, []);

  const hasContext = useMemo(() => uploadedDocuments.length > 0, [uploadedDocuments]);

  const uploadDocument = useCallback(async (
    file: File, 
    onStageChange?: (stage: ProcessingStage, progress: number) => void
  ): Promise<{ success: boolean; chunkCount: number; jobId?: string }> => {
    const targetConversationId = conversationId || externalConversationId;
    
    if (!targetConversationId) {
      toast.error('Please select or create a conversation first');
      return { success: false, chunkCount: 0 };
    }

    if (!user?.id) {
      toast.error('You must be logged in to upload documents');
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
    const jobId = crypto.randomUUID();
    const storagePath = `${user.id}/${targetConversationId}/${jobId}/${file.name}`;

    try {
      // 1. Create job record (user sees immediate feedback)
      onStageChange?.('uploading', 5);
      
      const { error: jobError } = await supabase.from('document_processing_jobs').insert({
        id: jobId,
        conversation_id: targetConversationId,
        user_id: user.id,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type || 'application/octet-stream',
        handler: fileConfig.handler,
        storage_path: storagePath,
        status: 'uploading',
        progress: 0,
      });

      if (jobError) {
        console.error('[RAG] Failed to create job record:', jobError);
        throw new Error('Failed to create processing job');
      }

      // Add to processing jobs state
      setProcessingJobs(prev => [...prev, {
        id: jobId,
        status: 'uploading',
        progress: 0,
        file_name: file.name,
        file_size: file.size,
        chunks_created: null,
        error_message: null,
      }]);

      // 2. Subscribe to job updates (real-time progress)
      const channel = supabase
        .channel(`job-${jobId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'document_processing_jobs',
            filter: `id=eq.${jobId}`,
          },
          (payload) => {
            const newData = payload.new as ProcessingJob;
            console.log('[RAG] Job update:', newData.status, newData.progress);
            
            // Update processing jobs state
            setProcessingJobs(prev => 
              prev.map(j => j.id === jobId ? { ...j, ...newData } : j)
            );

            // Map status to stage for callback
            const stageMap: Record<string, ProcessingStage> = {
              uploading: 'uploading',
              extracting: 'extracting',
              embedding: 'embedding',
              complete: 'complete',
              failed: 'error',
            };
            const stage = stageMap[newData.status] || 'extracting';
            onStageChange?.(stage, newData.progress || 0);

            // Handle completion
            if (newData.status === 'complete') {
              setUploadedDocuments(prev => [...prev, {
                filename: file.name,
                chunkCount: newData.chunks_created || 0,
                uploadedAt: new Date(),
                handler: fileConfig.handler,
              }]);
              toast.success(`${file.name} processed: ${newData.chunks_created} chunks created`);
              
              // Cleanup subscription
              supabase.removeChannel(channel);
              subscriptionsRef.current.delete(jobId);
            } else if (newData.status === 'failed') {
              toast.error(newData.error_message || 'Document processing failed');
              supabase.removeChannel(channel);
              subscriptionsRef.current.delete(jobId);
            }
          }
        )
        .subscribe();

      subscriptionsRef.current.set(jobId, channel);

      // 3. Upload to storage
      onStageChange?.('uploading', 10);
      
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('[RAG] Storage upload failed:', uploadError);
        await supabase.from('document_processing_jobs')
          .update({ status: 'failed', error_message: uploadError.message })
          .eq('id', jobId);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      onStageChange?.('uploading', 30);

      // 4. Trigger async processing via Edge Function
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Session expired');
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/embed-document`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            job_id: jobId,
            storage_path: storagePath,
            conversation_id: targetConversationId,
            handler: fileConfig.handler,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Processing failed' }));
        throw new Error(error.error || 'Failed to start document processing');
      }

      // User can now continue - processing happens async
      return { success: true, chunkCount: 0, jobId };
    } catch (error) {
      console.error('[RAG] Error uploading document:', error);
      onStageChange?.('error', 0);
      
      // Update job status to failed
      await supabase.from('document_processing_jobs')
        .update({ 
          status: 'failed', 
          error_message: error instanceof Error ? error.message : 'Unknown error' 
        })
        .eq('id', jobId);
      
      toast.error(error instanceof Error ? error.message : 'Failed to upload document');
      return { success: false, chunkCount: 0 };
    } finally {
      setIsUploading(false);
    }
  }, [conversationId, externalConversationId, user?.id]);

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
    processingJobs,
  };
}
