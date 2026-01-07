import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useNotebookLM() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const callStudio = useCallback(async (action: string, params: Record<string, any> = {}) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('studio-notebooklm', {
        body: { action, ...params }
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Unknown error');
      return data;
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return {
    loading,
    createNotebook: (title: string) => callStudio('create_notebook', { title }),
    listNotebooks: () => callStudio('list_notebooks'),
    addSources: (notebookId: string, sources: any[]) => callStudio('add_sources', { notebook_id: notebookId, sources }),
    chat: (notebookId: string, query: string, sessionId?: string) => callStudio('assist', { notebook_id: notebookId, query, session_id: sessionId }),
    generateArtifact: (notebookId: string, type: string, params?: any) => callStudio(`generate_${type}`, { notebook_id: notebookId, ...params }),
  };
}
