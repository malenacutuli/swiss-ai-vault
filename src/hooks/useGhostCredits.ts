import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type UsageType = 'text' | 'image' | 'video' | 'search' | 'tts' | 'stt';

interface GhostCreditsState {
  balance: number;
  isLoading: boolean;
  error: string | null;
}

interface GhostSubscription {
  plan: string;
  tokenLimit: number;
  expiresAt: string | null;
}

interface CreditCheckResult {
  allowed: boolean;
  balance: number;
  dailyRemaining: number;
  imageRemaining: number;
  videoRemaining: number;
  reason: string;
}

export function useGhostCredits() {
  const { user } = useAuth();
  const [state, setState] = useState<GhostCreditsState>({
    balance: 0,
    isLoading: true,
    error: null,
  });
  const [subscription, setSubscription] = useState<GhostSubscription | null>(null);

  const fetchCredits = useCallback(async () => {
    if (!user) {
      setState({ balance: 0, isLoading: false, error: null });
      return;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Fetch ghost credits
      const { data: creditsData, error: creditsError } = await supabase
        .from('ghost_credits')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();

      if (creditsError) throw creditsError;

      // Fetch subscription
      const { data: subData, error: subError } = await supabase
        .from('ghost_subscriptions')
        .select('plan, ghost_tokens_limit, expires_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError) throw subError;

      setState({
        balance: creditsData?.balance ?? 10000, // Default 10k tokens for new users
        isLoading: false,
        error: null,
      });

      if (subData) {
        setSubscription({
          plan: subData.plan,
          tokenLimit: subData.ghost_tokens_limit,
          expiresAt: subData.expires_at,
        });
      }
    } catch (error) {
      console.error('[Ghost Credits] Failed to fetch:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to load credits',
      }));
    }
  }, [user]);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  const deductCredits = useCallback(async (amount: number): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data, error } = await supabase.rpc('deduct_ghost_credits', {
        p_user_id: user.id,
        p_amount: amount,
      });

      if (error) throw error;

      if (data) {
        setState(prev => ({
          ...prev,
          balance: prev.balance - amount,
        }));
        return true;
      }

      return false;
    } catch (error) {
      console.error('[Ghost Credits] Failed to deduct:', error);
      return false;
    }
  }, [user]);

  const recordUsage = useCallback(async (
    serviceType: UsageType,
    modelId: string,
    options?: {
      inputTokens?: number;
      outputTokens?: number;
      durationSeconds?: number;
      resolution?: string;
    }
  ): Promise<{ success: boolean; creditsUsed: number; wasFreeTier: boolean }> => {
    if (!user) {
      return { success: false, creditsUsed: 0, wasFreeTier: false };
    }

    try {
      const { data, error } = await supabase.rpc('record_ghost_usage', {
        p_user_id: user.id,
        p_service_type: serviceType,
        p_model_id: modelId,
        p_input_tokens: options?.inputTokens ?? 0,
        p_output_tokens: options?.outputTokens ?? 0,
        p_duration_seconds: options?.durationSeconds ?? null,
        p_resolution: options?.resolution ?? null,
      });

      if (error) {
        console.error('[Ghost Credits] Failed to record usage:', error);
        return { success: false, creditsUsed: 0, wasFreeTier: false };
      }

      const result = data as Record<string, unknown> | null;
      
      // Refresh credits after recording usage
      await fetchCredits();

      return {
        success: (result?.success as boolean) ?? false,
        creditsUsed: (result?.credits_used as number) ?? 0,
        wasFreeTier: (result?.was_free_tier as boolean) ?? false,
      };
    } catch (error) {
      console.error('[Ghost Credits] Failed to record usage:', error);
      return { success: false, creditsUsed: 0, wasFreeTier: false };
    }
  }, [user, fetchCredits]);

  const checkCredits = useCallback(async (
    type: UsageType,
    estimatedCost: number = 0
  ): Promise<CreditCheckResult> => {
    if (!user) {
      return {
        allowed: false,
        balance: 0,
        dailyRemaining: 0,
        imageRemaining: 0,
        videoRemaining: 0,
        reason: 'not_authenticated',
      };
    }

    try {
      const { data, error } = await supabase.rpc('check_user_usage', {
        p_user_id: user.id,
        p_usage_type: type,
        p_estimated_cost_cents: estimatedCost,
      });

      if (error) {
        console.error('[Ghost Credits] Failed to check credits:', error);
        return {
          allowed: false,
          balance: 0,
          dailyRemaining: 0,
          imageRemaining: 0,
          videoRemaining: 0,
          reason: 'check_failed',
        };
      }

      const result = data as Record<string, unknown> | null;
      return {
        allowed: (result?.allowed as boolean) ?? false,
        balance: (result?.balance as number) ?? 0,
        dailyRemaining: (result?.daily_remaining as number) ?? 0,
        imageRemaining: (result?.image_remaining as number) ?? 0,
        videoRemaining: (result?.video_remaining as number) ?? 0,
        reason: (result?.reason as string) ?? '',
      };
    } catch (error) {
      console.error('[Ghost Credits] Failed to check credits:', error);
      return {
        allowed: false,
        balance: 0,
        dailyRemaining: 0,
        imageRemaining: 0,
        videoRemaining: 0,
        reason: 'check_failed',
      };
    }
  }, [user]);

  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(0)}K`;
    }
    return tokens.toLocaleString();
  };

  return {
    balance: state.balance,
    formattedBalance: formatTokens(state.balance),
    isLoading: state.isLoading,
    error: state.error,
    subscription,
    checkCredits,
    deductCredits,
    recordUsage,
    refreshCredits: fetchCredits,
  };
}
