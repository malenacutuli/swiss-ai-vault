import { useState, useEffect, useCallback } from 'react';
import { getProject, getProjectDocuments, type MemoryItem } from '@/lib/memory/memory-store';
import { useEncryptionContext } from '@/contexts/EncryptionContext';
import { supabase } from '@/integrations/supabase/client';

interface QuerySource {
  documentTitle: string;
  content: string;
}

interface QueryResult {
  response: string;
  sources: QuerySource[];
}

export function useProjectQuery(projectId: string) {
  const { getMasterKey, isUnlocked } = useEncryptionContext();
  const [isQuerying, setIsQuerying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [documents, setDocuments] = useState<MemoryItem[]>([]);
  const [projectInstructions, setProjectInstructions] = useState<string | undefined>();

  useEffect(() => {
    async function load() {
      if (!projectId || !isUnlocked) return;
      
      try {
        const key = await getMasterKey();
        if (!key) return;
        
        const [project, docs] = await Promise.all([
          getProject(projectId),
          getProjectDocuments(projectId, key),
        ]);
        
        setProjectInstructions(project?.instructions);
        setDocuments(docs);
        setIsReady(docs.length > 0);
      } catch (error) {
        console.error('Failed to load project documents:', error);
        setIsReady(false);
      }
    }
    
    load();
  }, [projectId, isUnlocked, getMasterKey]);

  const getDocumentTitle = (doc: MemoryItem): string => {
    return doc.metadata.title || doc.metadata.filename || 'Untitled Document';
  };

  const queryWithContext = useCallback(async (
    query: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<QueryResult> => {
    if (!isReady || documents.length === 0) {
      throw new Error('No documents available for querying');
    }

    setIsQuerying(true);
    
    try {
      // Build context from all documents (simple concatenation for now)
      // In production, you'd use embeddings + similarity search
      const documentContext = documents.map(doc => {
        const title = getDocumentTitle(doc);
        const preview = doc.content?.substring(0, 2000) || '';
        return `[Document: ${title}]\n${preview}`;
      }).join('\n\n---\n\n');

      // Build system prompt with project instructions
      let systemPrompt = `You are a helpful AI assistant that answers questions based ONLY on the provided documents. 
Do not make up information. If the answer is not in the documents, say so clearly.
Always cite which document your answer comes from.`;

      if (projectInstructions) {
        systemPrompt += `\n\nAdditional Instructions: ${projectInstructions}`;
      }

      systemPrompt += `\n\n--- DOCUMENTS ---\n${documentContext}\n--- END DOCUMENTS ---`;

      // Build messages array
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        ...conversationHistory,
        { role: 'user' as const, content: query }
      ];

      // Call the ghost-inference edge function
      const { data, error } = await supabase.functions.invoke('ghost-inference', {
        body: {
          messages,
          model: 'google/gemini-2.5-flash',
          temperature: 0.3,
          max_tokens: 2048,
        }
      });

      if (error) throw error;

      const response = data?.choices?.[0]?.message?.content || 'No response generated.';

      // Extract sources mentioned in the response
      const sources: QuerySource[] = [];
      documents.forEach(doc => {
        const title = getDocumentTitle(doc);
        if (response.toLowerCase().includes(title.toLowerCase())) {
          sources.push({
            documentTitle: title,
            content: doc.content?.substring(0, 500) || '',
          });
        }
      });

      return { response, sources };
    } finally {
      setIsQuerying(false);
    }
  }, [isReady, documents, projectInstructions]);

  return {
    queryWithContext,
    isQuerying,
    isReady,
    documentCount: documents.length,
  };
}
