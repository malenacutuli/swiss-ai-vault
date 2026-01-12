// src/hooks/useUserSettings.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  subscription_tier: string;
  credits: number;
  preferences: UserPreferences;
  created_at: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  default_model: string;
  temperature: number;
  language: string;
  notifications_email: boolean;
  notifications_push: boolean;
  privacy_mode: 'standard' | 'vault' | 'ghost';
  data_retention_days: number;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'light',
  default_model: 'gemini-2.0-flash',
  temperature: 0.7,
  language: 'en',
  notifications_email: true,
  notifications_push: false,
  privacy_mode: 'standard',
  data_retention_days: 365
};

export function useUserSettings() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (fetchError) throw fetchError;

      setProfile({
        ...data,
        preferences: { ...DEFAULT_PREFERENCES, ...(data.preferences || {}) }
      });
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user || !profile) return;

    setIsSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: updates.full_name,
          avatar_url: updates.avatar_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setProfile(prev => prev ? { ...prev, ...updates } : null);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [user, profile]);

  const updatePreferences = useCallback(async (prefs: Partial<UserPreferences>) => {
    if (!user || !profile) return;

    setIsSaving(true);
    try {
      const newPreferences = { ...profile.preferences, ...prefs };

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          preferences: newPreferences,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setProfile(prev => prev ? { ...prev, preferences: newPreferences } : null);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [user, profile]);

  return {
    profile,
    isLoading,
    isSaving,
    error,
    updateProfile,
    updatePreferences,
    refresh: fetchProfile
  };
}
