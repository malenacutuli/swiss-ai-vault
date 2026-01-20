import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type SubscriptionTier = "anonymous" | "free" | "pro" | "team" | "enterprise";

export interface ProductAccess {
  ghost_chat: boolean;
  vault_chat: boolean;
  vault_lab: boolean;
  api: boolean;
  commercial_models: boolean;
  deep_research: boolean;
  integrations: boolean;
}

export interface BillingStatus {
  subscription: {
    tier: SubscriptionTier;
    status: string;
    period_end: string | null;
  };
  access: ProductAccess;
  credits: {
    usage_balance_cents: number;
    training_balance_cents: number;
  };
  limits: {
    daily_text_limit: number | null;
    daily_image_limit: number | null;
    daily_video_limit: number | null;
    monthly_research_queries: number | null;
  };
}

// Define tier access levels
const TIER_ACCESS: Record<SubscriptionTier, ProductAccess> = {
  anonymous: {
    ghost_chat: true,
    vault_chat: false,
    vault_lab: false,
    api: false,
    commercial_models: false,
    deep_research: false,
    integrations: false,
  },
  free: {
    ghost_chat: true,
    vault_chat: false,
    vault_lab: false,
    api: false,
    commercial_models: false,
    deep_research: false,
    integrations: false,
  },
  pro: {
    ghost_chat: true,
    vault_chat: true,
    vault_lab: false,
    api: true,
    commercial_models: true,
    deep_research: true,
    integrations: true,
  },
  team: {
    ghost_chat: true,
    vault_chat: true,
    vault_lab: true,
    api: true,
    commercial_models: true,
    deep_research: true,
    integrations: true,
  },
  enterprise: {
    ghost_chat: true,
    vault_chat: true,
    vault_lab: true,
    api: true,
    commercial_models: true,
    deep_research: true,
    integrations: true,
  },
};

export const useProductAccess = () => {
  const { user } = useAuth();

  const { data: billingStatus, isLoading, error } = useQuery({
    queryKey: ["billing-status", user?.id],
    queryFn: async (): Promise<BillingStatus> => {
      if (!user) {
        return {
          subscription: { tier: "anonymous", status: "none", period_end: null },
          access: TIER_ACCESS.anonymous,
          credits: { usage_balance_cents: 0, training_balance_cents: 0 },
          limits: { daily_text_limit: 5, daily_image_limit: 3, daily_video_limit: 1, monthly_research_queries: 0 },
        };
      }

      // Check for admin role using existing RPC
      const { data: isAdmin } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role_name: 'admin'
      });

      // Also check user_settings for account_type
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('account_type')
        .eq('user_id', user.id)
        .maybeSingle();

      // Admin bypass: grant full access
      const hasAdminAccess = isAdmin === true || 
        userSettings?.account_type === 'admin' ||
        user.email?.includes('axessible.ai');

      if (hasAdminAccess) {
        return {
          subscription: { tier: "enterprise", status: "active", period_end: null },
          access: TIER_ACCESS.enterprise,
          credits: { usage_balance_cents: 999999999, training_balance_cents: 999999999 },
          limits: { daily_text_limit: null, daily_image_limit: null, daily_video_limit: null, monthly_research_queries: null },
        };
      }

      // Fetch billing customer data
      const { data: billing } = await supabase
        .from("billing_customers")
        .select("tier, subscription_status, current_period_end")
        .eq("user_id", user.id)
        .maybeSingle();

      // Fetch ghost credits for usage balance
      const { data: credits } = await supabase
        .from("ghost_credits")
        .select("paid_credits_balance, free_credits_remaining")
        .eq("user_id", user.id)
        .maybeSingle();

      const tier = (billing?.tier as SubscriptionTier) || "free";
      const access = TIER_ACCESS[tier] || TIER_ACCESS.free;

      // Define limits based on tier
      const limits = {
        daily_text_limit: tier === "anonymous" ? 5 : tier === "free" ? 25 : null,
        daily_image_limit: tier === "anonymous" ? 3 : tier === "free" ? 15 : tier === "pro" ? 100 : null,
        daily_video_limit: tier === "anonymous" ? 1 : tier === "free" ? 5 : tier === "pro" ? 20 : null,
        monthly_research_queries: tier === "free" ? 0 : tier === "pro" ? 50 : null,
      };

      return {
        subscription: {
          tier,
          status: billing?.subscription_status || "none",
          period_end: billing?.current_period_end || null,
        },
        access,
        credits: {
          usage_balance_cents: ((credits?.paid_credits_balance || 0) + (credits?.free_credits_remaining || 0)) * 100,
          training_balance_cents: 0, // Would come from team-specific table
        },
        limits,
      };
    },
    enabled: true,
    staleTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: true,
  });

  const tier = billingStatus?.subscription?.tier ?? (user ? "free" : "anonymous");
  const access = billingStatus?.access ?? TIER_ACCESS[tier];

  return {
    // Access flags
    canAccessGhostChat: access.ghost_chat,
    canAccessVaultChat: access.vault_chat,
    canAccessVaultLab: access.vault_lab,
    canAccessAPI: access.api,
    canUseCommercialModels: access.commercial_models,
    canUseDeepResearch: access.deep_research,
    canUseIntegrations: access.integrations,

    // Subscription info
    tier,
    subscriptionStatus: billingStatus?.subscription?.status ?? "none",
    periodEnd: billingStatus?.subscription?.period_end,

    // Credits
    usageBalanceCents: billingStatus?.credits?.usage_balance_cents ?? 0,
    trainingBalanceCents: billingStatus?.credits?.training_balance_cents ?? 0,

    // Limits
    limits: billingStatus?.limits ?? {
      daily_text_limit: null,
      daily_image_limit: null,
      daily_video_limit: null,
      monthly_research_queries: null,
    },

    // Status
    isLoading,
    error,

    // Full status object
    billingStatus,
  };
};
