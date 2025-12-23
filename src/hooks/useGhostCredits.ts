import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
    modelId: string,
    inputTokens: number,
    outputTokens: number
  ) => {
    if (!user) return;

    try {
      await supabase.from('ghost_usage').insert({
        user_id: user.id,
        model_id: modelId,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      });
    } catch (error) {
      console.error('[Ghost Credits] Failed to record usage:', error);
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
    deductCredits,
    recordUsage,
    refreshCredits: fetchCredits,
  };
}
