import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Credits {
  monthlyAllowance: number;
  monthlyUsed: number;
  monthlyRemaining: number;
  purchasedBalance: number;
  grantBalance: number;
  totalAvailable: number;
  resetsAt: Date | null;
}

const DEFAULT_CREDITS: Credits = {
  monthlyAllowance: 0,
  monthlyUsed: 0,
  monthlyRemaining: 0,
  purchasedBalance: 0,
  grantBalance: 0,
  totalAvailable: 0,
  resetsAt: null,
};

export function useCredits() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: credits, isLoading, refetch } = useQuery({
    queryKey: ['credits', user?.id],
    queryFn: async (): Promise<Credits> => {
      if (!user) return DEFAULT_CREDITS;

      const { data, error } = await supabase
        .from('unified_credits')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching credits:', error);
        return DEFAULT_CREDITS;
      }

      if (!data) return DEFAULT_CREDITS;

      const monthlyRemaining = Math.max(0, (data.monthly_allowance || 0) - (data.monthly_used || 0));

      return {
        monthlyAllowance: data.monthly_allowance || 0,
        monthlyUsed: data.monthly_used || 0,
        monthlyRemaining,
        purchasedBalance: data.purchased_balance || 0,
        grantBalance: data.grant_balance || 0,
        totalAvailable: monthlyRemaining + (data.purchased_balance || 0) + (data.grant_balance || 0),
        resetsAt: data.allowance_resets_at ? new Date(data.allowance_resets_at) : null,
      };
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  });

  const deductMutation = useMutation({
    mutationFn: async ({ amount, source }: { amount: number; source: string }) => {
      if (!user) throw new Error('Not authenticated');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('deduct_unified_credits', {
        p_user_id: user.id,
        p_amount: amount,
        p_source: source,
      });

      if (error) throw error;

      const result = data?.[0];
      if (!result?.success) throw new Error('Insufficient credits');

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credits', user?.id] });
    },
  });

  return {
    credits: credits || DEFAULT_CREDITS,
    isLoading,
    refetch,
    deductCredits: deductMutation.mutateAsync,
    isDeducting: deductMutation.isPending,
    hasCredits: (credits?.totalAvailable || 0) > 0,
  };
}

export type { Credits };
