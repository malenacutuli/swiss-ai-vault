import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type UsageType = 'text_prompts' | 'image_requests' | 'video_requests' | 'deep_research';

interface UsageStatus {
  allowed: boolean;
  current: number;
  limit: number | null;
  remaining: number | null;
}

// Generate anonymous fingerprint
async function getAnonymousFingerprint(): Promise<string> {
  const stored = localStorage.getItem('ghost_fingerprint');
  if (stored) return stored;

  const fingerprint = crypto.randomUUID();
  localStorage.setItem('ghost_fingerprint', fingerprint);
  return fingerprint;
}

export function useDailyUsage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const checkUsage = async (type: UsageType): Promise<UsageStatus> => {
    if (!user) {
      // Anonymous user
      const fingerprint = await getAnonymousFingerprint();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('check_anonymous_usage', {
        p_fingerprint_hash: fingerprint,
        p_usage_type: type,
      });

      if (error) {
        console.error('Error checking anonymous usage:', error);
        return { allowed: false, current: 0, limit: 10, remaining: 0 };
      }

      const result = data?.[0];
      return {
        allowed: result?.allowed ?? false,
        current: result?.current_usage ?? 0,
        limit: result?.daily_limit ?? 10,
        remaining: result?.daily_limit ? result.daily_limit - (result?.current_usage ?? 0) : 0,
      };
    }

    // Authenticated user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('check_usage_limit', {
      p_user_id: user.id,
      p_usage_type: type,
    });

    if (error) {
      console.error('Error checking usage:', error);
      return { allowed: false, current: 0, limit: null, remaining: null };
    }

    const result = data?.[0];
    return {
      allowed: result?.allowed ?? false,
      current: result?.current_usage ?? 0,
      limit: result?.daily_limit,
      remaining: result?.remaining,
    };
  };

  const incrementMutation = useMutation({
    mutationFn: async (type: UsageType): Promise<boolean> => {
      if (!user) {
        const fingerprint = await getAnonymousFingerprint();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.rpc as any)('increment_anonymous_usage', {
          p_fingerprint_hash: fingerprint,
          p_usage_type: type,
        });

        if (error) throw error;
        return data ?? false;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('increment_usage', {
        p_user_id: user.id,
        p_usage_type: type,
      });

      if (error) throw error;
      return data ?? false;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-usage'] });
    },
  });

  return {
    checkUsage,
    incrementUsage: incrementMutation.mutateAsync,
    isIncrementing: incrementMutation.isPending,
  };
}

export type { UsageType, UsageStatus };
