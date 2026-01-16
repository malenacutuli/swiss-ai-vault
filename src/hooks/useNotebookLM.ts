import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Types
export interface Notebook {
  id: string;
  google_id: string;
  title: string;
  source_count: number;
  created_at: Date;
}

export interface Source {
  id: string;
  type: 'pdf' | 'youtube' | 'web' | 'drive' | 'text';
  title: string;
  url?: string;
}

export interface ChatResponse {
  answer: string;
  grounding_metadata?: {
    chunks: Array<{
      source_id: string;
      title: string;
      uri: string;
    }>;
    supports: Array<{
      segment_text: string;
      page_number?: number;
      chunk_indices: number[];
    }>;
  };
  session_id?: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  difficulty: string;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
}

export interface MindMapNode {
  id: string;
  label: string;
  type: 'concept' | 'topic' | 'detail' | 'central' | 'subtopic';
  position?: { x: number; y: number };
}

export interface MindMapEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface Slide {
  number: number;
  layout: string;
  title: string;
  subtitle?: string;
  bullets?: string[];
  notes?: string;
}

export function useNotebookLM() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Core API caller
  const callProxy = useCallback(async <T>(
    action: string, 
    params: Record<string, any> = {}
  ): Promise<T> => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('notebooklm-proxy', {
        body: { action, ...params }
      });

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Unknown error');
      }

      return data.data as T;
    } catch (err: any) {
      const message = err.message || 'Failed to call NotebookLM API';
      setError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // ==================== NOTEBOOK MANAGEMENT ====================

  const createNotebook = useCallback(async (title: string): Promise<Notebook> => {
    toast({ title: "Creating notebook...", description: "Setting up your research workspace" });
    
    const result = await callProxy<any>('create_notebook', { title });
    
    toast({ title: "Notebook created!", description: title });
    
    return {
      id: result.id,
      google_id: result.google_id || result.id,
      title: result.title || title,
      source_count: 0,
      created_at: new Date(result.created_at)
    };
  }, [callProxy, toast]);

  const listNotebooks = useCallback(async (): Promise<Notebook[]> => {
    const result = await callProxy<any>('list_notebooks');
    return (result.notebooks || []).map((n: any) => ({
      id: n.id,
      google_id: n.google_id || n.id,
      title: n.title || 'Untitled',
      source_count: n.source_count || 0,
      created_at: new Date(n.created_at)
    }));
  }, [callProxy]);

  const deleteNotebook = useCallback(async (notebookId: string): Promise<void> => {
    await callProxy('delete_notebook', { notebook_id: notebookId });
    toast({ title: "Notebook deleted" });
  }, [callProxy, toast]);

  // ==================== SOURCE MANAGEMENT ====================

  const addSources = useCallback(async (
    notebookId: string,
    sources: Array<{
      pdf_url?: string;
      youtube_url?: string;
      web_url?: string;
      google_drive_id?: string;
      text?: string;
      title?: string;
    }>
  ): Promise<Source[]> => {
    toast({ title: "Adding sources...", description: `Processing ${sources.length} source(s)` });
    
    const result = await callProxy<any>('add_sources', {
      notebook_id: notebookId,
      sources
    });

    toast({ title: "Sources added!", description: `${sources.length} source(s) ingested` });
    
    // Map response to Source objects
    return (result.sources || []).map((s: any, i: number) => ({
      id: s.id || `source_${i}`,
      type: sources[i]?.pdf_url ? 'pdf' : 
            sources[i]?.youtube_url ? 'youtube' : 
            sources[i]?.web_url ? 'web' :
            sources[i]?.google_drive_id ? 'drive' : 'text',
      title: s.title || sources[i]?.title || 'Untitled',
      url: sources[i]?.pdf_url || sources[i]?.youtube_url || sources[i]?.web_url
    }));
  }, [callProxy, toast]);

  const listSources = useCallback(async (notebookId: string): Promise<Source[]> => {
    const result = await callProxy<any>('list_sources', { notebook_id: notebookId });
    return (result.sources || []).map((s: any) => ({
      id: s.id,
      type: s.source_type || 'text',
      title: s.title || 'Untitled',
      url: s.source_url
    }));
  }, [callProxy]);

  const deleteSource = useCallback(async (notebookId: string, sourceId: string): Promise<void> => {
    await callProxy('delete_source', { notebook_id: notebookId, source_id: sourceId });
    toast({ title: "Source removed" });
  }, [callProxy, toast]);

  // ==================== GROUNDED CHAT ====================

  const chat = useCallback(async (
    notebookId: string,
    query: string,
    sessionId?: string
  ): Promise<ChatResponse> => {
    const result = await callProxy<any>('chat', {
      notebook_id: notebookId,
      query,
      session_id: sessionId
    });

    return {
      answer: result.answer || result.response || '',
      grounding_metadata: result.groundingMetadata ? {
        chunks: (result.groundingMetadata.groundingChunks || []).map((c: any) => ({
          source_id: c.sourceId,
          title: c.title,
          uri: c.uri
        })),
        supports: (result.groundingMetadata.groundingSupports || []).map((s: any) => ({
          segment_text: s.segmentText,
          page_number: s.location?.pageNumber,
          chunk_indices: s.groundingChunkIndices || []
        }))
      } : undefined,
      session_id: result.session_id
    };
  }, [callProxy]);

  // ==================== ARTIFACT GENERATION ====================

  const generatePodcast = useCallback(async (
    notebookId: string,
    options?: {
      style?: 'DEEP_DIVE' | 'SUMMARY' | 'BRIEF' | 'DEBATE';
      focus?: string;
      language?: string;
    }
  ): Promise<{ transcript: string; segments?: any[] }> => {
    toast({ 
      title: "Generating podcast...", 
      description: "This typically takes 1-2 minutes" 
    });
    
    const result = await callProxy<any>('generate_podcast', {
      notebook_id: notebookId,
      style: options?.style || 'DEEP_DIVE',
      focus: options?.focus,
      language: options?.language || 'en-US'
    });
    
    toast({ title: "Podcast ready!", description: "Your audio overview is complete" });
    
    return {
      transcript: result.transcript || '',
      segments: result.segments || []
    };
  }, [callProxy, toast]);

  const generateQuiz = useCallback(async (
    notebookId: string,
    options?: {
      count?: number;
      difficulty?: 'EASY' | 'INTERMEDIATE' | 'HARD';
      focus?: string;
    }
  ): Promise<{ questions: QuizQuestion[] }> => {
    toast({ title: "Generating quiz..." });
    
    const result = await callProxy<any>('generate_quiz', {
      notebook_id: notebookId,
      count: options?.count || 10,
      difficulty: options?.difficulty || 'INTERMEDIATE',
      focus: options?.focus
    });
    
    toast({ title: "Quiz ready!" });
    
    return {
      questions: (result.questions || []).map((q: any, i: number) => ({
        id: `q_${i}`,
        question: q.question,
        options: q.options || q.choices || [],
        correct_index: q.correctIndex ?? q.correct ?? 0,
        explanation: q.explanation || '',
        difficulty: q.difficulty || options?.difficulty || 'INTERMEDIATE'
      }))
    };
  }, [callProxy, toast]);

  const generateFlashcards = useCallback(async (
    notebookId: string,
    options?: { count?: number; focus?: string }
  ): Promise<{ cards: Flashcard[] }> => {
    toast({ title: "Generating flashcards..." });
    
    const result = await callProxy<any>('generate_flashcards', {
      notebook_id: notebookId,
      count: options?.count || 20,
      focus: options?.focus
    });
    
    toast({ title: "Flashcards ready!" });
    
    return {
      cards: (result.cards || result.flashcards || []).map((c: any, i: number) => ({
        id: `card_${i}`,
        front: c.front || c.question,
        back: c.back || c.answer
      }))
    };
  }, [callProxy, toast]);

  const generateMindmap = useCallback(async (
    notebookId: string,
    options?: { max_nodes?: number; focus?: string }
  ): Promise<{ nodes: MindMapNode[]; edges: MindMapEdge[] }> => {
    toast({ title: "Generating mind map..." });
    
    const result = await callProxy<any>('generate_mindmap', {
      notebook_id: notebookId,
      max_nodes: options?.max_nodes || 30,
      focus: options?.focus
    });
    
    toast({ title: "Mind map ready!" });
    
    return {
      nodes: (result.nodes || []).map((n: any) => ({
        id: n.id,
        label: n.label || n.text,
        type: n.type || 'topic',
        position: n.position
      })),
      edges: (result.edges || []).map((e: any) => ({
        id: e.id,
        source: e.source || e.from,
        target: e.target || e.to,
        label: e.label
      }))
    };
  }, [callProxy, toast]);

  const generateSlides = useCallback(async (
    notebookId: string,
    options?: {
      template?: 'EXECUTIVE_PITCH' | 'EDUCATIONAL' | 'TECHNICAL';
      count?: number;
      focus?: string;
    }
  ): Promise<{ title?: string; slides: Slide[] }> => {
    toast({ title: "Generating presentation..." });
    
    const result = await callProxy<any>('generate_slides', {
      notebook_id: notebookId,
      template: options?.template || 'EXECUTIVE_PITCH',
      count: options?.count || 10,
      focus: options?.focus
    });
    
    toast({ title: "Presentation ready!" });
    
    return {
      title: result.title,
      slides: (result.slides || []).map((s: any, i: number) => ({
        number: s.number || i + 1,
        layout: s.layout || 'content',
        title: s.title,
        subtitle: s.subtitle,
        bullets: s.bullets || s.content || [],
        notes: s.speakerNotes || s.notes
      }))
    };
  }, [callProxy, toast]);

  const generateReport = useCallback(async (
    notebookId: string,
    options?: { max_length?: number; focus?: string }
  ): Promise<{ title?: string; content: string; sections: any[] }> => {
    toast({ title: "Generating report..." });
    
    const result = await callProxy<any>('generate_report', {
      notebook_id: notebookId,
      max_length: options?.max_length || 5000,
      focus: options?.focus
    });
    
    toast({ title: "Report ready!" });
    
    return {
      title: result.title,
      content: result.content || result.report || '',
      sections: result.sections || []
    };
  }, [callProxy, toast]);

  const generateStudyGuide = useCallback(async (
    notebookId: string,
    options?: { focus?: string }
  ): Promise<{ title?: string; content: string; sections: any[] }> => {
    toast({ title: "Generating study guide..." });
    
    const result = await callProxy<any>('generate_study_guide', {
      notebook_id: notebookId,
      focus: options?.focus
    });
    
    toast({ title: "Study guide ready!" });
    
    return {
      title: result.title,
      content: result.content || '',
      sections: result.sections || []
    };
  }, [callProxy, toast]);

  const generateFaq = useCallback(async (
    notebookId: string,
    options?: { count?: number; focus?: string }
  ): Promise<{ questions: Array<{ question: string; answer: string }> }> => {
    toast({ title: "Generating FAQ..." });
    
    const result = await callProxy<any>('generate_faq', {
      notebook_id: notebookId,
      count: options?.count || 20,
      focus: options?.focus
    });
    
    toast({ title: "FAQ ready!" });
    
    return {
      questions: (result.questions || result.faqs || []).map((q: any) => ({
        question: q.question || q.q,
        answer: q.answer || q.a
      }))
    };
  }, [callProxy, toast]);

  const generateTimeline = useCallback(async (
    notebookId: string,
    options?: { focus?: string }
  ): Promise<{ events: Array<{ date: string; title: string; description: string }> }> => {
    toast({ title: "Generating timeline..." });
    
    const result = await callProxy<any>('generate_timeline', {
      notebook_id: notebookId,
      focus: options?.focus
    });
    
    toast({ title: "Timeline ready!" });
    
    return {
      events: (result.events || result.timeline || []).map((e: any) => ({
        date: e.date || e.time,
        title: e.title || e.event,
        description: e.description || ''
      }))
    };
  }, [callProxy, toast]);

  const generateTable = useCallback(async (
    notebookId: string,
    options?: { focus?: string }
  ): Promise<{ title?: string; columns: string[]; rows: string[][] }> => {
    toast({ title: "Generating data table..." });
    
    const result = await callProxy<any>('generate_table', {
      notebook_id: notebookId,
      focus: options?.focus
    });
    
    toast({ title: "Table ready!" });
    
    return {
      title: result.title,
      columns: result.columns || result.headers || [],
      rows: result.rows || result.data || []
    };
  }, [callProxy, toast]);

  // Legacy method for backwards compatibility
  const generateArtifact = useCallback(async (
    notebookId: string,
    type: string,
    params?: any
  ): Promise<any> => {
    switch (type) {
      case 'podcast': return generatePodcast(notebookId, params);
      case 'quiz': return generateQuiz(notebookId, params);
      case 'flashcards': return generateFlashcards(notebookId, params);
      case 'mindmap': return generateMindmap(notebookId, params);
      case 'slides': return generateSlides(notebookId, params);
      case 'report': return generateReport(notebookId, params);
      case 'study_guide': return generateStudyGuide(notebookId, params);
      case 'faq': return generateFaq(notebookId, params);
      case 'timeline': return generateTimeline(notebookId, params);
      case 'table': return generateTable(notebookId, params);
      default: throw new Error(`Unknown artifact type: ${type}`);
    }
  }, [generatePodcast, generateQuiz, generateFlashcards, generateMindmap, generateSlides, generateReport, generateStudyGuide, generateFaq, generateTimeline, generateTable]);

  return {
    loading,
    error,
    // Notebook management
    createNotebook,
    listNotebooks,
    deleteNotebook,
    // Source management
    addSources,
    listSources,
    deleteSource,
    // Chat
    chat,
    // Artifact generation
    generatePodcast,
    generateQuiz,
    generateFlashcards,
    generateMindmap,
    generateSlides,
    generateReport,
    generateStudyGuide,
    generateFaq,
    generateTimeline,
    generateTable,
    // Legacy
    generateArtifact
  };
}
