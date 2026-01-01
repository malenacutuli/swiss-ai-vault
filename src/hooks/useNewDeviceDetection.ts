// src/hooks/useNewDeviceDetection.ts
// Detects when user has cloud backup but empty local memory

import { useState, useEffect, useCallback } from 'react';
import { useMemory } from './useMemory';
import { useMemorySync } from './useMemorySync';
import { getSavedProviderType } from '@/lib/memory/sync';

export function useNewDeviceDetection() {
  const [shouldShowRestore, setShouldShowRestore] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  
  const memory = useMemory();
  const { connected, checkCloudBackup } = useMemorySync({ autoSync: false });
  
  useEffect(() => {
    const checkNewDevice = async () => {
      // Skip if already checked this session
      if (hasChecked) return;
      
      // Skip if no sync provider configured
      const provider = getSavedProviderType();
      if (provider === 'none') {
        setHasChecked(true);
        return;
      }
      
      // Skip if user previously declined restore
      const declined = localStorage.getItem('sv_memory_restore_declined');
      if (declined) {
        const declinedTime = parseInt(declined, 10);
        const daysSinceDeclined = (Date.now() - declinedTime) / (1000 * 60 * 60 * 24);
        // Only ask again after 30 days
        if (daysSinceDeclined < 30) {
          setHasChecked(true);
          return;
        }
      }
      
      // Wait for memory to initialize
      if (!memory.isInitialized) return;
      
      // Check if local memory is empty
      try {
        const stats = await memory.getStats();
        
        if (stats.count === 0 && connected) {
          // Local is empty, check if cloud has backup
          const cloudStatus = await checkCloudBackup();
          
          if (cloudStatus.hasBackup) {
            setShouldShowRestore(true);
          }
        }
      } catch (error) {
        console.error('[NewDeviceDetection] Error:', error);
      }
      
      setHasChecked(true);
    };
    
    checkNewDevice();
  }, [memory.isInitialized, connected, hasChecked, memory, checkCloudBackup]);
  
  const dismissRestore = useCallback(() => {
    setShouldShowRestore(false);
    localStorage.setItem('sv_memory_restore_declined', Date.now().toString());
  }, []);
  
  return {
    shouldShowRestore,
    dismissRestore,
    hasChecked
  };
}
