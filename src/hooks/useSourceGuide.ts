import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SourceGuide {
  id: string;
  source_id: string;
  title: string;
  summary: string;
  key_topics: string[];
  suggested_questions: { text: string; rank: number }[];
  word_count: number;
  confidence_score: number;
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

  const generateGuide = useCallback(async (content: string, filename: string) => {
    if (!sourceId) return null;
    
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('source-guide', {
        body: { action: 'generate', sourceId, content, filename }
      });
      if (error) throw error;
      if (data?.success) {
        setGuide(data.guide);
        return data.guide;
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
    return null;
  }, [sourceId]);

  useEffect(() => {
    fetchGuide();
  }, [fetchGuide]);

  return { guide, loading, error, generateGuide, refetch: fetchGuide };
}
