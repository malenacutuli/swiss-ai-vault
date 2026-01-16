import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ResearchSource {
  type: 'document' | 'web';
  title: string;
  url?: string;
  source_id?: string;
  snippet: string;
  confidence: number;
}

interface ResearchResult {
  answer: string;
  sources: ResearchSource[];
  followUpQuestions: string[];
  iterations: number;
}

interface ResearchProgress {
  status: 'idle' | 'searching' | 'analyzing' | 'synthesizing' | 'complete' | 'error';
  currentStep: string;
  iteration: number;
  maxIterations: number;
}

export function useDeepResearch() {
  const [progress, setProgress] = useState<ResearchProgress>({
    status: 'idle',
    currentStep: '',
    iteration: 0,
    maxIterations: 3,
  });
  const [results, setResults] = useState<ResearchResult | null>(null);
  const { toast } = useToast();

  const conductResearch = useCallback(async (
    query: string,
    notebookId?: string,
    options?: {
      maxIterations?: number;
      includeWeb?: boolean;
      focusAreas?: string[];
    }
  ): Promise<ResearchResult> => {
    const maxIterations = options?.maxIterations || 3;
    const includeWeb = options?.includeWeb !== false;
    
    setProgress({
      status: 'searching',
      currentStep: 'Analyzing your question...',
      iteration: 1,
      maxIterations,
    });

    try {
      const allSources: ResearchSource[] = [];
      let synthesizedAnswer = '';
      const followUpQuestions: string[] = [];
      
      // Step 1: Search uploaded documents (if notebook provided)
      if (notebookId) {
        setProgress(p => ({ ...p, currentStep: 'Searching your documents...' }));
        
        const { data: docData, error: docError } = await supabase.functions.invoke('notebooklm-proxy', {
          body: {
            action: 'chat',
            notebook_id: notebookId,
            query: query,
          },
        });
        
        if (!docError && docData?.success && docData.data?.groundingMetadata?.groundingChunks) {
          const docSources: ResearchSource[] = docData.data.groundingMetadata.groundingChunks.map((chunk: any) => ({
            type: 'document' as const,
            title: chunk.title || 'Uploaded Document',
            source_id: chunk.sourceId,
            snippet: chunk.text || chunk.content || '',
            confidence: chunk.relevance_score || 0.8,
            url: chunk.uri,
          }));
          allSources.push(...docSources);
          
          // Use the chat answer as base
          if (docData.data?.answer) {
            synthesizedAnswer = docData.data.answer;
          }
        }
      }
      
      // Step 2: Web grounding (if enabled)
      if (includeWeb) {
        setProgress(p => ({ ...p, status: 'analyzing', currentStep: 'Searching the web...' }));
        
        try {
          const { data: webData, error: webError } = await supabase.functions.invoke('ghost-deep-research', {
            body: {
              query: query,
              mode: 'comprehensive',
              max_sources: 10,
            },
          });
          
          if (!webError && webData?.sources) {
            const webSources: ResearchSource[] = webData.sources.map((source: any) => ({
              type: 'web' as const,
              title: source.title,
              url: source.url,
              snippet: source.snippet || source.content || '',
              confidence: source.relevance || 0.7,
            }));
            allSources.push(...webSources);
          }
          
          if (webData?.answer) {
            synthesizedAnswer = webData.answer;
          }
          
          if (webData?.follow_up_questions) {
            followUpQuestions.push(...webData.follow_up_questions);
          }
        } catch (webErr) {
          console.warn('[useDeepResearch] Web search failed, continuing with docs only:', webErr);
        }
      }
      
      // Step 3: Synthesize with Gemini if we have mixed sources
      if (allSources.length > 0 && (!synthesizedAnswer || (notebookId && includeWeb))) {
        setProgress(p => ({ ...p, status: 'synthesizing', currentStep: 'Synthesizing findings...' }));
        
        try {
          const { data: synthData } = await supabase.functions.invoke('ghost-inference', {
            body: {
              model: 'gemini-2.5-flash',
              messages: [
                {
                  role: 'system',
                  content: `You are a research synthesizer for SwissBrAIn, a Swiss AI research platform. 
Combine the following sources into a comprehensive answer.
Cite each claim with [1], [2], etc. matching the source order.
Be thorough but concise. Highlight key findings.
At the end, suggest 3 follow-up questions for deeper research.

Format your response as:
1. Main answer with citations
2. A section titled "Suggested follow-up questions:" with 3 numbered questions`,
                },
                {
                  role: 'user',
                  content: `Question: ${query}\n\nSources:\n${allSources.map((s, i) => 
                    `[${i + 1}] ${s.title}: ${s.snippet.slice(0, 500)}`
                  ).join('\n\n')}`,
                },
              ],
              temperature: 0.3,
            },
          });
          
          if (synthData?.content) {
            synthesizedAnswer = synthData.content;
            
            // Extract follow-up questions from response
            const followUpMatch = synthesizedAnswer.match(/follow-up questions?:?\s*([\s\S]*?)$/i);
            if (followUpMatch) {
              const questions = followUpMatch[1].match(/\d+\.\s*(.+)/g);
              if (questions) {
                followUpQuestions.length = 0; // Clear existing
                followUpQuestions.push(...questions.map(q => q.replace(/^\d+\.\s*/, '').trim()));
              }
            }
          }
        } catch (synthErr) {
          console.warn('[useDeepResearch] Synthesis failed:', synthErr);
        }
      }
      
      // Complete
      const result: ResearchResult = {
        answer: synthesizedAnswer || 'No results found. Try refining your query.',
        sources: allSources,
        followUpQuestions: followUpQuestions.slice(0, 3),
        iterations: 1,
      };
      
      setResults(result);
      setProgress({
        status: 'complete',
        currentStep: 'Research complete!',
        iteration: 1,
        maxIterations,
      });
      
      toast({ title: "Research Complete", description: `Found ${allSources.length} sources` });
      
      return result;
      
    } catch (err: any) {
      setProgress(p => ({ ...p, status: 'error', currentStep: err.message }));
      toast({ title: "Research Failed", description: err.message, variant: "destructive" });
      throw err;
    }
  }, [toast]);

  const reset = useCallback(() => {
    setProgress({ status: 'idle', currentStep: '', iteration: 0, maxIterations: 3 });
    setResults(null);
  }, []);

  return {
    progress,
    results,
    conductResearch,
    reset,
  };
}
