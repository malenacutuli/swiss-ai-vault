import { useState, useEffect, useCallback, useRef } from 'react';
import { getProject, getProjectDocuments, searchMemoriesInProject, type MemoryItem } from '@/lib/memory/memory-store';
import { useEncryptionContext } from '@/contexts/EncryptionContext';
import { supabase } from '@/integrations/supabase/client';

// Lazy import embedding engine to avoid circular deps
const getEmbeddingEngine = async () => {
  const engine = await import('@/lib/memory/embedding-engine');
  return engine;
};

interface QuerySource {
  documentTitle: string;
  content: string;
  relevanceScore?: number;
}

interface QueryResult {
  response: string;
  sources: QuerySource[];
}

export function useProjectQuery(projectId: string) {
  const { getMasterKey, isUnlocked } = useEncryptionContext();
  const [isQuerying, setIsQuerying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [documentCount, setDocumentCount] = useState(0);
  const [projectInstructions, setProjectInstructions] = useState<string | undefined>();
  const encryptionKeyRef = useRef<CryptoKey | null>(null);

  useEffect(() => {
    async function load() {
      if (!projectId || !isUnlocked) return;
      
      try {
        const key = await getMasterKey();
        if (!key) return;
        encryptionKeyRef.current = key;
        
        // Initialize embedding engine for semantic search
        const engine = await getEmbeddingEngine();
        if (!engine.isReady()) {
          console.log('[ProjectQuery] Initializing embedding engine...');
          await engine.initEmbeddings();
        }
        
        const [project, docs] = await Promise.all([
          getProject(projectId),
          getProjectDocuments(projectId, key),
        ]);
        
        setProjectInstructions(project?.instructions);
        setDocumentCount(docs.length);
        setIsReady(docs.length > 0);
        
        console.log('[ProjectQuery] Ready with', docs.length, 'document chunks');
      } catch (error) {
        console.error('Failed to load project documents:', error);
        setIsReady(false);
      }
    }
    
    load();
  }, [projectId, isUnlocked, getMasterKey]);

  const queryWithContext = useCallback(async (
    query: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<QueryResult> => {
    if (!isReady || !encryptionKeyRef.current) {
      throw new Error('Project not ready for querying');
    }

    setIsQuerying(true);
    
    try {
      console.log('[ProjectQuery] Searching for:', query);
      
      // Generate query embedding for semantic search
      const engine = await getEmbeddingEngine();
      const queryEmbedding = await engine.embed(query);
      
      // Semantic search across project documents - get top 15 chunks
      const relevantChunks = await searchMemoriesInProject(
        queryEmbedding,
        projectId,
        encryptionKeyRef.current,
        { topK: 15, minScore: 0.2 }
      );
      
      console.log('[ProjectQuery] Found', relevantChunks.length, 'relevant chunks');
      
      if (relevantChunks.length === 0) {
        return {
          response: "No encontré información relevante en los documentos del proyecto. Intenta reformular tu pregunta o verifica que los documentos contengan la información que buscas.",
          sources: []
        };
      }
      
      // Build context from relevant chunks (~15K tokens max)
      const documentContext = relevantChunks.map(({ item, score }) => {
        const title = item.metadata.title || item.metadata.filename || 'Documento';
        const chunk = item.metadata.chunkIndex !== undefined 
          ? ` (Sección ${(item.metadata.chunkIndex || 0) + 1}/${item.metadata.totalChunks || 1})`
          : '';
        return `[Fuente: ${title}${chunk} | Relevancia: ${(score * 100).toFixed(0)}%]\n${item.content}`;
      }).join('\n\n---\n\n');

      // Build system prompt with project instructions
      let systemPrompt = `Eres un asistente de IA especializado en análisis de documentos para due diligence y consultoría.

INSTRUCCIONES CRÍTICAS:
- Responde ÚNICAMENTE basándote en los extractos de documentos proporcionados a continuación
- Cita documentos específicos por nombre al hacer afirmaciones
- Si la información no está en los documentos, di claramente "Esta información no se encuentra en los documentos proporcionados"
- Sé preciso y referencia secciones específicas cuando sea posible
- Proporciona respuestas detalladas y estructuradas`;

      if (projectInstructions) {
        systemPrompt += `\n\nInstrucciones específicas del proyecto:\n${projectInstructions}`;
      }

      systemPrompt += `\n\n=== EXTRACTOS RELEVANTES DE DOCUMENTOS ===\n${documentContext}\n=== FIN DE EXTRACTOS ===`;

      // Build messages array
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        ...conversationHistory,
        { role: 'user' as const, content: query }
      ];

      // Call inference with stable model (gemini-2.0-flash)
      const { data, error } = await supabase.functions.invoke('ghost-inference', {
        body: {
          messages,
          model: 'gemini-2.0-flash',
          temperature: 0.2,
          max_tokens: 4096,
        }
      });

      if (error) throw error;

      const response = data?.choices?.[0]?.message?.content || 'No se generó respuesta.';

      // Build sources from retrieved chunks
      const sources: QuerySource[] = relevantChunks.slice(0, 5).map(({ item, score }) => ({
        documentTitle: item.metadata.title || item.metadata.filename || 'Documento',
        content: item.content.substring(0, 300) + '...',
        relevanceScore: score
      }));

      return { response, sources };
    } finally {
      setIsQuerying(false);
    }
  }, [isReady, projectId, projectInstructions]);

  return {
    queryWithContext,
    isQuerying,
    isReady,
    documentCount,
  };
}
