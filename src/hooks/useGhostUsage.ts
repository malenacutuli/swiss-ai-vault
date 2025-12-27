import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation } from '@tanstack/react-query';

interface GhostUsage {
  prompts_used: number;
  images_generated: number;
  videos_generated: number;
  files_uploaded: number;
  web_searches: number;
}

interface GhostSubscription {
  tier: 'free' | 'pro';
  current_period_end: string | null;
}

interface UsageLimits {
  prompts: number;
  images: number;
  videos: number;
  files: number;
  searches: number;
}

const FREE_LIMITS: UsageLimits = {
  prompts: 15,
  images: 3,
  videos: 3,
  files: 5,
  searches: 5,
};

const PRO_LIMITS: UsageLimits = {
  prompts: 999999, // Unlimited
  images: 50,
  videos: 20,
  files: 50,
  searches: 999999, // Unlimited
};

export function useGhostUsage() {
  const { user } = useAuth();

  // Fetch subscription
  const { data: subscription } = useQuery({
    queryKey: ['ghost-subscription', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('ghost_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      
      // Extract tier from data, defaulting to 'free'
      const tier = (data as Record<string, unknown>)?.tier as 'free' | 'pro' || 'free';
      const current_period_end = (data as Record<string, unknown>)?.current_period_end as string | null || null;
      
      return { tier, current_period_end } as GhostSubscription;
    },
    enabled: !!user,
  });

  // Fetch today's usage
  const { data: usage, refetch: refetchUsage } = useQuery({
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
      
      // Return data or default empty usage
      return (data as GhostUsage) || { 
        prompts_used: 0, 
        images_generated: 0, 
        videos_generated: 0, 
        files_uploaded: 0, 
        web_searches: 0 
      };
    },
    enabled: !!user,
    refetchInterval: 60000, // Refresh every minute
  });

  // Get limits based on tier
  const limits = subscription?.tier === 'pro' ? PRO_LIMITS : FREE_LIMITS;
  const isPro = subscription?.tier === 'pro';

  // Calculate remaining
  const remaining = {
    prompts: Math.max(0, limits.prompts - (usage?.prompts_used || 0)),
    images: Math.max(0, limits.images - (usage?.images_generated || 0)),
    videos: Math.max(0, limits.videos - (usage?.videos_generated || 0)),
    files: Math.max(0, limits.files - (usage?.files_uploaded || 0)),
    searches: Math.max(0, limits.searches - (usage?.web_searches || 0)),
  };

  // Check if can use feature
  const canUse = {
    prompt: remaining.prompts > 0,
    image: remaining.images > 0,
    video: remaining.videos > 0,
    file: remaining.files > 0,
    search: remaining.searches > 0,
  };

  // Increment usage mutation
  const incrementUsage = useMutation({
    mutationFn: async (type: 'prompt' | 'image' | 'video' | 'file' | 'search') => {
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase.rpc('increment_ghost_usage', {
        p_user_id: user.id,
        p_type: type,
      });
      
      if (error) throw error;
      return data as { allowed: boolean; current: number; limit: number; remaining?: number; type: string; resets_at?: string };
    },
    onSuccess: () => {
      refetchUsage();
    },
  });

  // Check and increment (returns false if limit reached)
  const useFeature = useCallback(async (type: 'prompt' | 'image' | 'video' | 'file' | 'search') => {
    try {
      const result = await incrementUsage.mutateAsync(type);
      return result.allowed;
    } catch (error) {
      console.error('Failed to increment usage:', error);
      return false;
    }
  }, [incrementUsage]);

  // Time until reset (midnight UTC)
  const getResetTime = () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return tomorrow;
  };

  return {
    // Subscription info
    tier: subscription?.tier || 'free',
    isPro,
    
    // Usage info
    usage: usage || { prompts_used: 0, images_generated: 0, videos_generated: 0, files_uploaded: 0, web_searches: 0 },
    limits,
    remaining,
    canUse,
    
    // Actions
    useFeature,
    refetchUsage,
    
    // Reset info
    resetTime: getResetTime(),
  };
}
