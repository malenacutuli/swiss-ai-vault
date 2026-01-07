import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ArtifactJob {
  id: string;
  status: string;
  artifact_type: string;
  result_storage_key?: string;
  result_metadata?: Record<string, any>;
  error_message?: string;
  created_at?: string;
  started_at?: string;
  completed_at?: string;
}

export function useArtifactJob(jobId: string | null) {
  const [job, setJob] = useState<ArtifactJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchJob = useCallback(async () => {
    if (!jobId) return false;

    try {
      const { data, error: fetchError } = await supabase
        .from('artifact_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (fetchError) {
        setError(fetchError.message);
        return true; // Stop polling on error
      }

      if (data) {
        setJob(data as ArtifactJob);
        if (['completed', 'failed', 'cancelled'].includes(data.status)) {
          setLoading(false);
          return true; // Stop polling
        }
      }
      return false;
    } catch (err: any) {
      setError(err.message);
      return true;
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    // Initial fetch
    fetchJob();

    // Poll every 2 seconds
    const interval = setInterval(async () => {
      const done = await fetchJob();
      if (done) clearInterval(interval);
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId, fetchJob]);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    fetchJob();
  }, [fetchJob]);

  return { 
    job, 
    loading, 
    error,
    isCompleted: job?.status === 'completed',
    isFailed: job?.status === 'failed',
    retry,
  };
}
