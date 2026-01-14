// src/hooks/useArtifacts.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Artifact {
  id: string;
  type: string;
  mime_type: string;
  file_name: string;
  file_size_bytes: number;
  storage_path: string;
  created_by_run_id: string;
  created_at: string;
  metadata: Record<string, any>;
}

export function useArtifacts(runId?: string) {
  const { user } = useAuth();
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchArtifacts = useCallback(async () => {
    if (!user) {
      setArtifacts([]);
      setIsLoading(false);
      return;
    }

    try {
      // Using type assertion since 'artifacts' table may not exist in schema yet
      let query = (supabase.from('artifacts' as any) as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (runId) {
        query = query.eq('created_by_run_id', runId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setArtifacts((data as Artifact[]) || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user, runId]);

  useEffect(() => {
    fetchArtifacts();
  }, [fetchArtifacts]);

  const getDownloadUrl = async (artifactId: string): Promise<string | null> => {
    try {
      const artifact = artifacts.find(a => a.id === artifactId);
      if (!artifact) return null;

      const { data } = await supabase.storage
        .from('artifacts')
        .createSignedUrl(artifact.storage_path, 3600);

      return data?.signedUrl || null;
    } catch (err) {
      console.error('Failed to get download URL:', err);
      return null;
    }
  };

  const deleteArtifact = async (artifactId: string) => {
    try {
      const { error } = await (supabase.from('artifacts' as any) as any)
        .delete()
        .eq('id', artifactId);

      if (error) throw error;
      setArtifacts(prev => prev.filter(a => a.id !== artifactId));
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  return {
    artifacts,
    isLoading,
    error,
    refresh: fetchArtifacts,
    getDownloadUrl,
    deleteArtifact
  };
}
