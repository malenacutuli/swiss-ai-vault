import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface GhostFolder {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  sort_order?: number;
  created_at?: string;
}

export const useGhostFolders = () => {
  const { user } = useAuth();
  const [folders, setFolders] = useState<GhostFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const fetchingRef = useRef(false);
  const initializedRef = useRef(false);
  
  // Stable fetch function
  const fetchFolders = useCallback(async () => {
    if (!user?.id || fetchingRef.current) return;
    
    fetchingRef.current = true;
    try {
      const { data, error } = await supabase
        .from('ghost_folders')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true });
      
      if (error) {
        console.error('[useGhostFolders] Failed to fetch folders:', error);
      } else {
        console.log('[useGhostFolders] Fetched folders:', data?.length || 0);
        setFolders(data || []);
      }
    } finally {
      fetchingRef.current = false;
      setIsLoading(false);
    }
  }, [user?.id]);
  
  // Fetch folders on mount (only once per user)
  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      setFolders([]);
      initializedRef.current = false;
      return;
    }
    
    // Prevent double initialization in React Strict Mode
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    fetchFolders();
  }, [user?.id, fetchFolders]);
  
  // Create folder with optimistic update and toast
  const createFolder = useCallback(async (name: string = 'New Folder'): Promise<GhostFolder | null> => {
    if (!user?.id) return null;
    
    const newFolder = {
      user_id: user.id,
      name,
      sort_order: folders.length,
    };
    
    const { data, error } = await supabase
      .from('ghost_folders')
      .insert(newFolder)
      .select()
      .single();
    
    if (error) {
      console.error('[useGhostFolders] Failed to create folder:', error);
      toast.error('Failed to create folder');
      return null;
    }
    
    console.log('[useGhostFolders] Created folder:', data.id, data.name);
    setFolders(prev => [...prev, data]);
    toast.success('Folder created');
    return data;
  }, [user?.id, folders.length]);
  
  // Rename folder with optimistic update
  const renameFolder = useCallback(async (id: string, name: string): Promise<boolean> => {
    // Optimistic update
    setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f));
    
    const { error } = await supabase
      .from('ghost_folders')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', id);
    
    if (error) {
      console.error('[useGhostFolders] Failed to rename folder:', error);
      // Revert on error
      await fetchFolders();
      toast.error('Failed to rename folder');
      return false;
    }
    
    console.log('[useGhostFolders] Renamed folder:', id, name);
    toast.success('Folder renamed');
    return true;
  }, [fetchFolders]);
  
  // Delete folder with optimistic update
  const deleteFolder = useCallback(async (id: string): Promise<boolean> => {
    // Optimistic update
    setFolders(prev => prev.filter(f => f.id !== id));
    
    const { error } = await supabase
      .from('ghost_folders')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('[useGhostFolders] Failed to delete folder:', error);
      // Revert on error
      await fetchFolders();
      toast.error('Failed to delete folder');
      return false;
    }
    
    console.log('[useGhostFolders] Deleted folder:', id);
    toast.success('Folder deleted');
    return true;
  }, [fetchFolders]);
  
  // Reorder folders
  const reorderFolders = useCallback(async (orderedIds: string[]) => {
    // Optimistic update
    setFolders(prev => {
      const sorted = [...prev].sort((a, b) => {
        return orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id);
      });
      return sorted;
    });
    
    // Batch update
    const updates = orderedIds.map((id, index) => ({
      id,
      sort_order: index,
    }));
    
    for (const update of updates) {
      await supabase
        .from('ghost_folders')
        .update({ sort_order: update.sort_order })
        .eq('id', update.id);
    }
  }, []);
  
  return {
    folders,
    isLoading,
    createFolder,
    renameFolder,
    deleteFolder,
    reorderFolders,
    refreshFolders: fetchFolders,
  };
};
