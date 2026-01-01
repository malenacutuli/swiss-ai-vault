import { useState, useEffect, useCallback } from 'react';
import { getMasterKey, isVaultUnlocked } from '@/lib/crypto/key-vault';
import {
  UserProfile,
  loadProfile,
  saveProfile,
  extractInsightsFromConversation,
  generateProfileContext,
  exportProfile
} from '@/lib/memory/user-profile';

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  
  // Check vault status
  useEffect(() => {
    const checkVault = () => {
      const unlocked = isVaultUnlocked();
      setIsUnlocked(unlocked);
      if (unlocked && !profile) {
        loadUserProfile();
      }
    };
    
    checkVault();
    const interval = setInterval(checkVault, 1000);
    return () => clearInterval(interval);
  }, [profile]);
  
  const loadUserProfile = useCallback(async () => {
    if (!isVaultUnlocked()) return;
    
    try {
      setIsLoading(true);
      const key = getMasterKey();
      const loaded = await loadProfile(key);
      setProfile(loaded);
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Learn from a conversation
  const learnFromConversation = useCallback(async (
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  ) => {
    if (!profile || !isVaultUnlocked()) return;
    
    try {
      const key = getMasterKey();
      const updated = await extractInsightsFromConversation(messages, profile, key);
      setProfile(updated);
    } catch (error) {
      console.error('Failed to learn from conversation:', error);
    }
  }, [profile]);
  
  // Get context for AI
  const getContextPrompt = useCallback(() => {
    if (!profile) return '';
    return generateProfileContext(profile);
  }, [profile]);
  
  // Manual profile update
  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!profile || !isVaultUnlocked()) return;
    
    try {
      const key = getMasterKey();
      const updated = { ...profile, ...updates, lastUpdated: Date.now() };
      await saveProfile(updated, key);
      setProfile(updated);
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  }, [profile]);
  
  // Export profile
  const exportUserProfile = useCallback(async () => {
    if (!isVaultUnlocked()) throw new Error('Vault locked');
    const key = getMasterKey();
    return exportProfile(key);
  }, []);
  
  // Add a key fact manually
  const addKeyFact = useCallback(async (fact: string, confidence = 0.9) => {
    if (!profile) return;
    
    const newFact = {
      fact,
      confidence,
      source: 'explicit' as const,
      extractedAt: Date.now()
    };
    
    await updateProfile({
      keyFacts: [...profile.keyFacts, newFact]
    });
  }, [profile, updateProfile]);
  
  // Remove a key fact
  const removeKeyFact = useCallback(async (factText: string) => {
    if (!profile) return;
    
    await updateProfile({
      keyFacts: profile.keyFacts.filter(f => f.fact !== factText)
    });
  }, [profile, updateProfile]);
  
  return {
    profile,
    isLoading,
    isReady: !!profile && isUnlocked,
    learnFromConversation,
    getContextPrompt,
    updateProfile,
    exportProfile: exportUserProfile,
    addKeyFact,
    removeKeyFact,
    reload: loadUserProfile
  };
}
