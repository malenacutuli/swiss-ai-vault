import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface HealthFolder {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  sort_order?: number;
  created_at?: string;
}

/**
 * Hook to manage health folders for VaultHealth conversations.
 * Uses the ghost_folders table with a health-specific prefix for names.
 */
export const useHealthFolders = () => {
  const { user } = useAuth();
  const [folders, setFolders] = useState<HealthFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const fetchingRef = useRef(false);
  const initializedRef = useRef(false);
  
  // Stable fetch function - fetch folders that start with "health:" prefix
  const fetchFolders = useCallback(async () => {
    if (!user?.id || fetchingRef.current) return;
    
    fetchingRef.current = true;
    try {
      const { data, error } = await supabase
        .from('ghost_folders')
        .select('*')
        .eq('user_id', user.id)
        .ilike('name', 'health:%')
        .order('sort_order', { ascending: true });
      
      if (error) {
        console.error('[useHealthFolders] Failed to fetch folders:', error);
      } else {
        // Strip the "health:" prefix for display
        const healthFolders = (data || []).map(f => ({
          ...f,
          name: f.name.replace(/^health:/, '')
        }));
        console.log('[useHealthFolders] Fetched folders:', healthFolders.length);
        setFolders(healthFolders);
      }
    } finally {
      fetchingRef.current = false;
      setIsLoading(false);
    }
  }, [user?.id]);
  
  // Fetch folders on mount
  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      setFolders([]);
      initializedRef.current = false;
      return;
    }
    
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    fetchFolders();
  }, [user?.id, fetchFolders]);
  
  // Create folder
  const createFolder = useCallback(async (name: string = 'New Folder'): Promise<HealthFolder | null> => {
    if (!user?.id) {
      toast.error('Please sign in to create folders');
      return null;
    }
    
    const newFolder = {
      user_id: user.id,
      name: `health:${name}`, // Prefix with health:
      sort_order: folders.length,
    };
    
    const { data, error } = await supabase
      .from('ghost_folders')
      .insert(newFolder)
      .select()
      .single();
    
    if (error) {
      console.error('[useHealthFolders] Failed to create folder:', error);
      toast.error('Failed to create folder');
      return null;
    }
    
    const folder = { ...data, name: data.name.replace(/^health:/, '') };
    console.log('[useHealthFolders] Created folder:', folder.id, folder.name);
    setFolders(prev => [...prev, folder]);
    toast.success('Folder created');
    return folder;
  }, [user?.id, folders.length]);
  
  // Rename folder
  const renameFolder = useCallback(async (id: string, name: string): Promise<boolean> => {
    // Optimistic update
    setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f));
    
    const { error } = await supabase
      .from('ghost_folders')
      .update({ name: `health:${name}`, updated_at: new Date().toISOString() })
      .eq('id', id);
    
    if (error) {
      console.error('[useHealthFolders] Failed to rename folder:', error);
      await fetchFolders();
      toast.error('Failed to rename folder');
      return false;
    }
    
    console.log('[useHealthFolders] Renamed folder:', id, name);
    toast.success('Folder renamed');
    return true;
  }, [fetchFolders]);
  
  // Delete folder
  const deleteFolder = useCallback(async (id: string): Promise<boolean> => {
    // Optimistic update
    setFolders(prev => prev.filter(f => f.id !== id));
    
    const { error } = await supabase
      .from('ghost_folders')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('[useHealthFolders] Failed to delete folder:', error);
      await fetchFolders();
      toast.error('Failed to delete folder');
      return false;
    }
    
    console.log('[useHealthFolders] Deleted folder:', id);
    toast.success('Folder deleted');
    return true;
  }, [fetchFolders]);
  
  return {
    folders,
    isLoading,
    createFolder,
    renameFolder,
    deleteFolder,
    refetch: fetchFolders,
  };
};
