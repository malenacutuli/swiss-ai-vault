import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type SubscriptionTier = 'ghost_free' | 'ghost_pro' | 'premium' | 'enterprise';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete';

export interface Subscription {
  tier: SubscriptionTier;
  tierDisplayName: string;
  isOrgMember: boolean;
  orgId: string | null;
  orgName: string | null;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  seatsTotal: number;
  seatsUsed: number;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

export interface TierLimits {
  textPromptsPerDay: number | null; // null = unlimited
  imagesPerDay: number | null;
  videosPerDay: number | null;
  deepResearchPerDay: number | null;
  canBackupHistory: boolean;
  canAccessNewModels: boolean;
  canUseApi: boolean;
  canTrainModels: boolean;
  canUseVaultChat: boolean;
  canUseVaultLabs: boolean;
  canUseIntegrations: boolean;
  canManageOrg: boolean;
}

export interface UsageToday {
  textPrompts: number;
  imageRequests: number;
  videoRequests: number;
  deepResearch: number;
}

const DEFAULT_SUBSCRIPTION: Subscription = {
  tier: 'ghost_free',
  tierDisplayName: 'Ghost Free',
  isOrgMember: false,
  orgId: null,
  orgName: null,
  status: 'active',
  currentPeriodEnd: null,
  seatsTotal: 0,
  seatsUsed: 0,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
};

const DEFAULT_LIMITS: TierLimits = {
  textPromptsPerDay: 10,
  imagesPerDay: 2,
  videosPerDay: 2,
  deepResearchPerDay: 0,
  canBackupHistory: false,
  canAccessNewModels: false,
  canUseApi: false,
  canTrainModels: false,
  canUseVaultChat: false,
  canUseVaultLabs: false,
  canUseIntegrations: false,
  canManageOrg: false,
};

const DEFAULT_USAGE: UsageToday = {
  textPrompts: 0,
  imageRequests: 0,
  videoRequests: 0,
  deepResearch: 0,
};

export function useSubscription() {
  const { user } = useAuth();

  // Fetch subscription, tier info, AND admin status in a single query to avoid hooks order issues
  const { 
    data: subscriptionData, 
    isLoading: isLoadingSubscription, 
    refetch 
  } = useQuery({
    queryKey: ['unified-subscription', user?.id],
    queryFn: async (): Promise<{ subscription: Subscription; limits: TierLimits; isAdmin: boolean }> => {
      if (!user) return { subscription: DEFAULT_SUBSCRIPTION, limits: DEFAULT_LIMITS, isAdmin: false };

      // Check admin role first
      let isAdmin = false;
      const { data: adminData, error: adminError } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin'
      });
      
      if (!adminError && adminData === true) {
        isAdmin = true;
      }

      // Get tier info from RPC function (fallback to direct query if RPC fails)
      let tierInfo = { 
        tier: 'ghost_free', 
        tier_display_name: 'Ghost Free',
        is_org_member: false,
        org_id: null,
        org_name: null
      };

      const { data: tierData, error: tierError } = await supabase
        .rpc('get_user_tier', { p_user_id: user.id });

      if (tierError) {
        console.error('Error fetching tier from RPC:', tierError);
        // Fallback: get tier directly from unified_subscriptions
        const { data: fallbackData } = await supabase
          .from('unified_subscriptions')
          .select('tier')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (fallbackData) {
          tierInfo.tier = fallbackData.tier || 'ghost_free';
          tierInfo.tier_display_name = fallbackData.tier === 'ghost_pro' ? 'Ghost Pro' : 
            fallbackData.tier === 'premium' ? 'SwissBrAIn Pro' : 
            fallbackData.tier === 'enterprise' ? 'Enterprise' : 'Ghost Free';
        }
      } else {
        tierInfo = tierData?.[0] || tierInfo;
      }

      // Get subscription details from unified_subscriptions
      const { data: subData } = await supabase
        .from('unified_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      // Get tier limits
      const { data: limitsData } = await supabase
        .from('tier_limits')
        .select('*')
        .eq('tier', tierInfo.tier || 'ghost_free')
        .single();

      const subscription: Subscription = {
        tier: (tierInfo.tier || 'ghost_free') as SubscriptionTier,
        tierDisplayName: tierInfo.tier_display_name || 'Ghost Free',
        isOrgMember: tierInfo.is_org_member || false,
        orgId: tierInfo.org_id || null,
        orgName: tierInfo.org_name || null,
        status: (subData?.status || 'active') as SubscriptionStatus,
        currentPeriodEnd: subData?.current_period_end ? new Date(subData.current_period_end) : null,
        seatsTotal: subData?.seats_purchased || 0,
        seatsUsed: 0,
        stripeCustomerId: subData?.stripe_customer_id || null,
        stripeSubscriptionId: subData?.stripe_subscription_id || null,
      };

      const limits: TierLimits = limitsData ? {
        textPromptsPerDay: limitsData.text_prompts_per_day,
        imagesPerDay: limitsData.images_per_day,
        videosPerDay: limitsData.videos_per_day,
        deepResearchPerDay: limitsData.deep_research_per_day,
        canBackupHistory: limitsData.can_backup_history ?? false,
        canAccessNewModels: limitsData.can_access_new_models ?? false,
        canUseApi: limitsData.can_use_api ?? false,
        canTrainModels: limitsData.can_train_models ?? false,
        canUseVaultChat: limitsData.can_use_vault_chat ?? false,
        canUseVaultLabs: limitsData.can_use_vault_labs ?? false,
        canUseIntegrations: limitsData.can_use_integrations ?? false,
        canManageOrg: limitsData.can_manage_org ?? false,
      } : DEFAULT_LIMITS;

      return { subscription, limits, isAdmin };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch today's usage
  const { data: usageToday, isLoading: isLoadingUsage, refetch: refetchUsage } = useQuery({
    queryKey: ['unified-daily-usage', user?.id],
    queryFn: async (): Promise<UsageToday> => {
      if (!user) return DEFAULT_USAGE;

      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('unified_daily_usage')
        .select('*')
        .eq('user_id', user.id)
        .eq('usage_date', today)
        .maybeSingle();

      if (error) {
        console.error('Error fetching usage:', error);
        return DEFAULT_USAGE;
      }

      return {
        textPrompts: data?.text_prompts || 0,
        imageRequests: data?.image_requests || 0,
        videoRequests: data?.video_requests || 0,
        deepResearch: data?.deep_research || 0,
      };
    },
    enabled: !!user,
    staleTime: 30 * 1000, // 30 seconds
  });

  const subscription = subscriptionData?.subscription || DEFAULT_SUBSCRIPTION;
  const limits = subscriptionData?.limits || DEFAULT_LIMITS;
  const usage = usageToday || DEFAULT_USAGE;
  const adminBypass = subscriptionData?.isAdmin === true;

  // Calculate remaining usage
  const getRemainingUsage = (type: 'text' | 'image' | 'video' | 'research') => {
    const limitMap = {
      text: limits.textPromptsPerDay,
      image: limits.imagesPerDay,
      video: limits.videosPerDay,
      research: limits.deepResearchPerDay,
    };
    const usageMap = {
      text: usage.textPrompts,
      image: usage.imageRequests,
      video: usage.videoRequests,
      research: usage.deepResearch,
    };

    const limit = limitMap[type];
    const used = usageMap[type];

    if (limit === null) return { unlimited: true, remaining: Infinity, used, limit: null };
    return { unlimited: false, remaining: Math.max(0, limit - used), used, limit };
  };

  // Check if user can perform action
  const canUse = (type: 'text' | 'image' | 'video' | 'research'): boolean => {
    const { unlimited, remaining } = getRemainingUsage(type);
    return unlimited || remaining > 0;
  };

  // Increment usage (calls RPC function)
  const incrementUsage = async (type: 'text' | 'image' | 'video' | 'research') => {
    if (!user) return { allowed: false, error: 'Not authenticated' };

    const { data, error } = await supabase.rpc('increment_unified_usage', {
      p_user_id: user.id,
      p_usage_type: type,
    });

    if (error) {
      console.error('Error incrementing usage:', error);
      return { allowed: false, error: error.message };
    }

    // Refetch usage after increment
    await refetchUsage();
    
    return data;
  };

  return {
    // Core data
    subscription,
    limits,
    usage,
    isAdmin: adminBypass,
    
    // Loading states
    isLoading: isLoadingSubscription || isLoadingUsage,
    isLoadingSubscription,
    isLoadingUsage,
    
    // Refresh functions
    refetch,
    refetchUsage,
    
    // Tier convenience booleans (admin bypasses all)
    isFree: !adminBypass && subscription.tier === 'ghost_free',
    isPro: adminBypass || subscription.tier === 'ghost_pro',
    isPremium: adminBypass || subscription.tier === 'premium',
    isEnterprise: adminBypass || subscription.tier === 'enterprise',
    
    // Feature access (admin has all access)
    hasVaultAccess: adminBypass || ['premium', 'enterprise'].includes(subscription.tier),
    hasApiAccess: adminBypass || limits.canUseApi,
    canTrainModels: adminBypass || limits.canTrainModels,
    canBackupHistory: adminBypass || limits.canBackupHistory,
    canAccessNewModels: adminBypass || limits.canAccessNewModels,
    canUseIntegrations: adminBypass || limits.canUseIntegrations,
    canManageOrg: adminBypass || limits.canManageOrg,
    
    // Usage helpers
    getRemainingUsage,
    canUse,
    incrementUsage,
  };
}
