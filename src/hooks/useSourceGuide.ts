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
    setLoading(true);
    setError(null);
    try {
      console.log('Calling source-guide edge function with action: generate_inline');
      const { data, error } = await supabase.functions.invoke('source-guide', {
        body: { action: 'generate_inline', content, filename }
      });
      
      if (error) {
        console.error('source-guide invoke error:', error);
        throw error;
      }
      
      if (data?.success && data?.guide) {
        console.log('Source Guide generated successfully:', data.guide.title);
        setGuide(data.guide);
        return data.guide;
      }
      
      throw new Error('Failed to generate guide - no data returned');
    } catch (err: any) {
      console.error('generateGuideInline error:', err);
      setError(err.message);
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
