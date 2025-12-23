import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
  
  // Fetch folders on mount
  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    
    const fetchFolders = async () => {
      const { data, error } = await supabase
        .from('ghost_folders')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true });
      
      if (error) {
        console.error('Failed to fetch folders:', error);
      } else {
        setFolders(data || []);
      }
      setIsLoading(false);
    };
    
    fetchFolders();
  }, [user?.id]);
  
  // Create folder
  const createFolder = async (name: string = 'New Folder') => {
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
      console.error('Failed to create folder:', error);
      return null;
    }
    
    setFolders(prev => [...prev, data]);
    return data;
  };
  
  // Rename folder
  const renameFolder = async (id: string, name: string) => {
    const { error } = await supabase
      .from('ghost_folders')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', id);
    
    if (error) {
      console.error('Failed to rename folder:', error);
      return false;
    }
    
    setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f));
    return true;
  };
  
  // Delete folder
  const deleteFolder = async (id: string) => {
    const { error } = await supabase
      .from('ghost_folders')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Failed to delete folder:', error);
      return false;
    }
    
    setFolders(prev => prev.filter(f => f.id !== id));
    return true;
  };
  
  // Reorder folders
  const reorderFolders = async (orderedIds: string[]) => {
    const updates = orderedIds.map((id, index) => ({
      id,
      sort_order: index,
    }));
    
    // Batch update
    for (const update of updates) {
      await supabase
        .from('ghost_folders')
        .update({ sort_order: update.sort_order })
        .eq('id', update.id);
    }
    
    setFolders(prev => {
      const sorted = [...prev].sort((a, b) => {
        return orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id);
      });
      return sorted;
    });
  };
  
  return {
    folders,
    isLoading,
    createFolder,
    renameFolder,
    deleteFolder,
    reorderFolders,
  };
};
