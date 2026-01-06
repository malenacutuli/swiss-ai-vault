import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface GhostTierData {
  tier: 'ghost_free' | 'ghost_pro' | 'swissvault_pro';
  features: {
    prompts_per_day: number;
    images_per_day: number;
    videos_per_day: number;
    files_per_day: number;
    searches_per_day: number;
    models: string[];
    commercial_models?: boolean;
    vault_chat?: boolean;
    fine_tuning?: boolean;
    api_access?: boolean;
  };
}

interface GhostUsage {
  prompts_used: number;
  images_generated: number;
  videos_generated: number;
  files_uploaded: number;
  web_searches: number;
}

interface UsageCheckResult {
  allowed: boolean;
  current?: number;
  limit?: number;
  remaining?: number;
  unlimited?: boolean;
  tier?: string;
  resets_at?: string;
  error?: string;
}

export function useGhostUsage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Check if user is admin
  const { data: isAdmin } = useQuery({
    queryKey: ['is-admin', user?.id],
    queryFn: async () => {
      if (!user) return false;
      
      const { data, error } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin',
      });
      
      if (error) return false;
      return data === true;
    },
    enabled: !!user,
    staleTime: 300000, // Cache for 5 minutes
  });

  // Fetch tier info using database function
  const { data: tierData, isLoading: tierLoading } = useQuery({
    queryKey: ['ghost-tier', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase.rpc('get_ghost_tier', {
        p_user_id: user.id,
      });
      
      if (error) throw error;
      return data as unknown as GhostTierData;
    },
    enabled: !!user,
    staleTime: 60000, // Cache for 1 minute
  });

  // Fetch today's usage
  const { data: usage, refetch: refetchUsage, isLoading: usageLoading } = useQuery({
    queryKey: ['ghost-usage', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('ghost_usage')
        .select('prompts_used, images_generated, videos_generated, files_uploaded, web_searches')
        .eq('user_id', user.id)
        .eq('usage_date', today)
        .maybeSingle();
      
      if (error) throw error;
      
      return (data || {
        prompts_used: 0,
        images_generated: 0,
        videos_generated: 0,
        files_uploaded: 0,
        web_searches: 0,
      }) as GhostUsage;
    },
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Parse tier from database response
  const tier = tierData?.tier || 'ghost_free';
  const features = tierData?.features || {
    prompts_per_day: 15,
    images_per_day: 3,
    videos_per_day: 3,
    files_per_day: 5,
    searches_per_day: 5,
    models: ['swissvault-1.0'],
  };

  // Calculate remaining (-1 means unlimited, admins get unlimited)
  const adminBypass = isAdmin === true;
  const remaining = {
    prompts: adminBypass || features.prompts_per_day === -1 ? Infinity : Math.max(0, features.prompts_per_day - (usage?.prompts_used || 0)),
    images: adminBypass || features.images_per_day === -1 ? Infinity : Math.max(0, features.images_per_day - (usage?.images_generated || 0)),
    videos: adminBypass || features.videos_per_day === -1 ? Infinity : Math.max(0, features.videos_per_day - (usage?.videos_generated || 0)),
    files: adminBypass || features.files_per_day === -1 ? Infinity : Math.max(0, features.files_per_day - (usage?.files_uploaded || 0)),
    searches: adminBypass || features.searches_per_day === -1 ? Infinity : Math.max(0, features.searches_per_day - (usage?.web_searches || 0)),
  };

  // Admin users can always use all features
  const canUse = {
    prompt: adminBypass || remaining.prompts > 0,
    image: adminBypass || remaining.images > 0,
    video: adminBypass || remaining.videos > 0,
    file: adminBypass || remaining.files > 0,
    search: adminBypass || remaining.searches > 0,
  };

  // Check and increment usage using database function
  const useFeature = useCallback(async (type: 'prompt' | 'image' | 'video' | 'file' | 'search'): Promise<UsageCheckResult> => {
    if (!user) return { allowed: false, error: 'Not authenticated' };
    
    try {
      const { data, error } = await supabase.rpc('check_ghost_usage', {
        p_user_id: user.id,
        p_type: type,
      });
      
      if (error) throw error;
      
      // Refresh usage data
      queryClient.invalidateQueries({ queryKey: ['ghost-usage', user.id] });
      
      return data as unknown as UsageCheckResult;
    } catch (error) {
      console.error('Usage check failed:', error);
      return { allowed: false, error: 'Failed to check usage' };
    }
  }, [user, queryClient]);

  // Time until reset (midnight UTC)
  const getResetTime = () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return tomorrow;
  };

  const isPro = adminBypass || tier === 'ghost_pro' || tier === 'swissvault_pro';
  const isSwissVaultPro = adminBypass || tier === 'swissvault_pro';
  const hasCommercialModels = features.commercial_models === true;

  return {
    // Tier info
    tier,
    features,
    isPro,
    isSwissVaultPro,
    hasCommercialModels,
    
    // Loading states
    isLoading: tierLoading || usageLoading,
    
    // Usage info
    usage: usage || { prompts_used: 0, images_generated: 0, videos_generated: 0, files_uploaded: 0, web_searches: 0 },
    remaining,
    canUse,
    
    // Limits (for display)
    limits: {
      prompts: features.prompts_per_day,
      images: features.images_per_day,
      videos: features.videos_per_day,
      files: features.files_per_day,
      searches: features.searches_per_day,
    },
    
    // Actions
    useFeature,
    refetchUsage,
    
    // Reset info
    resetTime: getResetTime(),
  };
}
