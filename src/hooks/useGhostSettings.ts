import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getGhostStorage, GhostSettings, DEFAULT_GHOST_SETTINGS } from '@/lib/ghost/ghost-storage';
import { toast } from 'sonner';

/**
 * useGhostSettings - Local-first settings for Ghost Chat
 * 
 * All settings are stored encrypted in IndexedDB, never sent to server.
 * This aligns with Venice.ai's "zero server storage" philosophy.
 */
export function useGhostSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<GhostSettings>(DEFAULT_GHOST_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const initRef = useRef(false);

  // Load settings from local IndexedDB when storage is ready
  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    // Check localStorage for quick initial load
    const cached = localStorage.getItem('ghost-settings');
    if (cached) {
      try {
        setSettings({ ...DEFAULT_GHOST_SETTINGS, ...JSON.parse(cached) });
      } catch {
        // Invalid cache, ignore
      }
    }

    // Load from encrypted IndexedDB
    const loadSettings = async () => {
      const storage = getGhostStorage();
      
      // Wait for storage to be initialized
      let attempts = 0;
      while (!storage.isInitialized() && attempts < 50) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }

      if (storage.isInitialized()) {
        try {
          const loaded = await storage.getSettings();
          setSettings(loaded);
          // Cache in localStorage for fast access
          localStorage.setItem('ghost-settings', JSON.stringify(loaded));
        } catch (error) {
          console.error('[useGhostSettings] Load error:', error);
        }
      }
      
      setIsLoading(false);
    };

    loadSettings();
  }, [user?.id]);

  const updateSettings = useCallback(async (updates: Partial<GhostSettings>) => {
    const newSettings = { ...settings, ...updates };
    
    // Optimistic update
    setSettings(newSettings);
    localStorage.setItem('ghost-settings', JSON.stringify(newSettings));

    if (!user) return;

    setIsSaving(true);
    try {
      const storage = getGhostStorage();
      if (storage.isInitialized()) {
        await storage.saveSettings(updates);
      }
    } catch (error) {
      console.error('[useGhostSettings] Save error:', error);
      // Rollback on error
      setSettings(settings);
      localStorage.setItem('ghost-settings', JSON.stringify(settings));
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  }, [user, settings]);

  const resetToDefaults = useCallback(async () => {
    setSettings(DEFAULT_GHOST_SETTINGS);
    localStorage.setItem('ghost-settings', JSON.stringify(DEFAULT_GHOST_SETTINGS));

    if (!user) return;

    try {
      const storage = getGhostStorage();
      if (storage.isInitialized()) {
        await storage.resetSettings();
      }
      toast.success('Settings reset to defaults');
    } catch (error) {
      console.error('[useGhostSettings] Reset error:', error);
    }
  }, [user]);

  return {
    settings,
    updateSettings,
    resetToDefaults,
    isLoading,
    isSaving,
  };
}

// Re-export types for convenience
export type { GhostSettings };
export { DEFAULT_GHOST_SETTINGS };
