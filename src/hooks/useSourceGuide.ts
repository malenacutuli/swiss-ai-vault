import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SourceGuide {
  id?: string;
  source_id?: string;
  title: string;
  summary: string;
  key_topics: string[];
  suggested_questions: { text: string; rank: number }[];
  word_count?: number;
  confidence_score?: number;
}

export function useSourceGuide(sourceId: string | null) {
  const [guide, setGuide] = useState<SourceGuide | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGuide = useCallback(async () => {
    if (!sourceId) {
      setGuide(null);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('source-guide', {
        body: { action: 'get', sourceId }
      });
      if (error) throw error;
      if (data?.success) setGuide(data.guide);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sourceId]);

  // Generate guide WITH database storage (requires sourceId)
  const generateGuide = useCallback(async (content: string, filename: string, srcId?: string) => {
    const effectiveSourceId = srcId || sourceId;
    if (!effectiveSourceId) {
      console.warn('generateGuide called without sourceId');
      return null;
    }
    
    setLoading(true);
    setError(null);
    try {
      console.log('Calling source-guide edge function with action: generate');
      const { data, error } = await supabase.functions.invoke('source-guide', {
        body: { action: 'generate', sourceId: effectiveSourceId, content, filename }
      });
      if (error) throw error;
      if (data?.success) {
        setGuide(data.guide);
        return data.guide;
      }
    } catch (err: any) {
      console.error('generateGuide error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
    return null;
  }, [sourceId]);

  // Generate guide inline (no database storage - for immediate display)
  const generateGuideInline = useCallback(async (content: string, filename: string): Promise<SourceGuide | null> => {
    console.log('🟢 [useSourceGuide] generateGuideInline called');
    console.log('🟢 [useSourceGuide] Filename:', filename);
    console.log('🟢 [useSourceGuide] Content length:', content.length);
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('🟢 [useSourceGuide] Calling source-guide edge function...');
      
      const { data, error } = await supabase.functions.invoke('source-guide', {
        body: { action: 'generate_inline', content, filename }
      });
      
      console.log('🟢 [useSourceGuide] Edge function response:', { data, error });
      
      if (error) {
        console.error('🔴 [useSourceGuide] Edge function error:', error);
        throw error;
      }
      
      if (data?.success && data?.guide) {
        console.log('✅ [useSourceGuide] Guide generated successfully!');
        console.log('✅ [useSourceGuide] Title:', data.guide.title);
        
        // Normalize the guide data (handle both snake_case and camelCase)
        const normalizedGuide: SourceGuide = {
          title: data.guide.title || filename,
          summary: data.guide.summary || '',
          key_topics: data.guide.key_topics || data.guide.keyTopics || [],
          suggested_questions: data.guide.suggested_questions || data.guide.suggestedQuestions || [],
          word_count: data.guide.word_count || data.guide.wordCount,
          confidence_score: data.guide.confidence_score || data.guide.confidence
        };
        
        setGuide(normalizedGuide);
        return normalizedGuide;
      }
      
      console.error('🔴 [useSourceGuide] No guide in response:', data);
      throw new Error('Failed to generate guide - no data returned');
    } catch (err: any) {
      console.error('🔴 [useSourceGuide] Error:', err);
      setError(err.message || 'Failed to generate guide');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Clear guide state
  const clearGuide = useCallback(() => {
    setGuide(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (sourceId) {
      fetchGuide();
    }
  }, [fetchGuide, sourceId]);

  return { 
    guide, 
    loading, 
    error, 
    generateGuide, 
    generateGuideInline,
    clearGuide,
    refetch: fetchGuide 
  };
}
