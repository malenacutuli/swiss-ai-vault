// src/hooks/useMemorySync.ts
// Hook for automatic background synchronization of memory

import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { 
  createSyncProvider, 
  getSavedProviderType,
  SyncProvider,
  SyncProviderType
} from '@/lib/memory/sync';

interface SyncState {
  status: 'idle' | 'syncing' | 'error' | 'offline';
  lastSync: number | null;
  error: string | null;
  provider: SyncProviderType;
  connected: boolean;
}

interface UseMemorySyncOptions {
  autoSync?: boolean;
  syncInterval?: number; // ms, default 5 minutes
  onConflict?: (local: Blob, remote: Blob) => Promise<'local' | 'remote' | 'merge'>;
}

const DEFAULT_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
const DEBOUNCE_DELAY = 30 * 1000; // 30 seconds after last change

export function useMemorySync(options: UseMemorySyncOptions = {}) {
  const { 
    autoSync = true, 
    syncInterval = DEFAULT_SYNC_INTERVAL,
    onConflict 
  } = options;
  
  const { toast } = useToast();
  
  const [state, setState] = useState<SyncState>({
    status: 'idle',
    lastSync: null,
    error: null,
    provider: getSavedProviderType(),
    connected: false
  });
  
  const providerRef = useRef<SyncProvider | null>(null);
  const syncTimeoutRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  
  // Initialize provider
  useEffect(() => {
    const providerType = getSavedProviderType();
    
    if (providerType !== 'none') {
      providerRef.current = createSyncProvider(providerType);
      
      // Check connection status
      providerRef.current.getStatus().then((status) => {
        if (isMountedRef.current) {
          setState(prev => ({
            ...prev,
            connected: status.connected,
            lastSync: status.lastSync,
            provider: providerType
          }));
        }
      });
    } else {
      // Local only - always "connected"
      providerRef.current = createSyncProvider('none');
      setState(prev => ({
        ...prev,
        connected: true,
        provider: 'none'
      }));
    }
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Perform sync
  const performSync = useCallback(async (_force: boolean = false) => {
    const provider = providerRef.current;
    const providerType = getSavedProviderType();
    
    // Skip sync for local-only mode
    if (providerType === 'none') {
      return { success: true, reason: 'Local only mode' };
    }
    
    if (!provider || !provider.isConnected()) {
      return { success: false, reason: 'Not connected' };
    }
    
    setState(prev => ({ ...prev, status: 'syncing', error: null }));
    
    try {
      // Get local memory export
      const { exportMemories, importMemories, getMemoryStats } = await import('@/lib/memory/memory-manager');
      const localStats = await getMemoryStats();
      const localBlob = await exportMemories();
      
      // Check for remote backup
      const remoteFiles = await provider.list();
      const lastSyncTime = await provider.getLastSyncTime();
      
      // Since list() returns string[], we need to handle this differently
      // For now, just upload if we have local data
      if (remoteFiles.length > 0 && localStats.count === 0 && onConflict) {
        // Has remote but no local - potential restore scenario
        const latestRemote = remoteFiles[0];
        const remoteBlob = await provider.download(latestRemote);
        
        if (remoteBlob) {
          const resolution = await onConflict(localBlob, remoteBlob);
          
          if (resolution === 'remote') {
            await importMemories(remoteBlob);
            await provider.setLastSyncTime(Date.now());
            
            toast({
              title: 'Memory restored',
              description: 'Your memory was restored from cloud backup.'
            });
          }
        }
      } else if (localStats.count > 0) {
        // Has local data - upload
        await provider.upload(localBlob, `memory-backup-${Date.now()}.svmem`);
        await provider.setLastSyncTime(Date.now());
      }
      
      const newLastSync = Date.now();
      setState(prev => ({
        ...prev,
        status: 'idle',
        lastSync: newLastSync,
        error: null
      }));
      
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Sync failed';
      
      setState(prev => ({
        ...prev,
        status: 'error',
        error: errorMsg
      }));
      
      return { success: false, reason: errorMsg };
    }
  }, [toast, onConflict]);
  
  // Manual sync trigger
  const sync = useCallback(async () => {
    return performSync(true);
  }, [performSync]);
  
  // Schedule debounced sync (called after memory changes)
  const scheduleSync = useCallback(() => {
    const providerType = getSavedProviderType();
    if (!autoSync || providerType === 'none') return;
    
    const provider = providerRef.current;
    if (!provider?.isConnected()) return;
    
    // Clear existing debounce
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    // Schedule sync after debounce delay
    debounceTimeoutRef.current = setTimeout(() => {
      performSync(false);
    }, DEBOUNCE_DELAY);
  }, [autoSync, performSync]);
  
  // Auto-sync on interval
  useEffect(() => {
    if (!autoSync) return;
    
    const providerType = getSavedProviderType();
    if (providerType === 'none') return;
    
    // Initial sync on mount (if connected)
    const initialSync = async () => {
      const provider = providerRef.current;
      if (provider?.isConnected()) {
        await performSync(false);
      }
    };
    
    initialSync();
    
    // Set up interval
    syncTimeoutRef.current = setInterval(() => {
      if (providerRef.current?.isConnected()) {
        performSync(false);
      }
    }, syncInterval);
    
    return () => {
      if (syncTimeoutRef.current) {
        clearInterval(syncTimeoutRef.current);
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [autoSync, syncInterval, performSync]);
  
  // Restore from cloud (for new device setup)
  const restoreFromCloud = useCallback(async () => {
    const provider = providerRef.current;
    if (!provider?.isConnected()) {
      throw new Error('Not connected to sync provider');
    }
    
    setState(prev => ({ ...prev, status: 'syncing' }));
    
    try {
      const remoteFiles = await provider.list();
      
      if (remoteFiles.length === 0) {
        throw new Error('No backup found in cloud');
      }
      
      const latestRemote = remoteFiles[0];
      const remoteBlob = await provider.download(latestRemote);
      
      if (!remoteBlob) {
        throw new Error('Failed to download backup');
      }
      
      const { importMemories } = await import('@/lib/memory/memory-manager');
      const count = await importMemories(remoteBlob);
      
      await provider.setLastSyncTime(Date.now());
      
      setState(prev => ({
        ...prev,
        status: 'idle',
        lastSync: Date.now()
      }));
      
      toast({
        title: 'Memory restored',
        description: `${count} items restored from backup.`
      });
      
      return { success: true, count };
    } catch (error) {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Restore failed'
      }));
      throw error;
    }
  }, [toast]);
  
  // Check if cloud has backup (for new device detection)
  const checkCloudBackup = useCallback(async (): Promise<{
    hasBackup: boolean;
    lastModified?: number;
  }> => {
    const provider = providerRef.current;
    if (!provider?.isConnected()) {
      return { hasBackup: false };
    }
    
    try {
      const remoteFiles = await provider.list();
      
      if (remoteFiles.length === 0) {
        return { hasBackup: false };
      }
      
      return {
        hasBackup: true
      };
    } catch {
      return { hasBackup: false };
    }
  }, []);
  
  // Reconnect to provider
  const reconnect = useCallback(async () => {
    const provider = providerRef.current;
    if (provider && !provider.isConnected()) {
      await provider.connect();
      setState(prev => ({ ...prev, connected: true }));
    }
  }, []);
  
  return {
    // State
    ...state,
    isSyncing: state.status === 'syncing',
    hasError: state.status === 'error',
    
    // Actions
    sync,
    scheduleSync,
    restoreFromCloud,
    checkCloudBackup,
    reconnect
  };
}
