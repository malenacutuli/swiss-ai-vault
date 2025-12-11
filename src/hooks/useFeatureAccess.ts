import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface FeatureAccess {
  dashboard: boolean;
  projects: boolean;
  datasets: boolean;
  fine_tuning: boolean;
  templates: boolean;
  evaluations: boolean;
  models: boolean;
  catalog: boolean;
  playground: boolean;
  vault_chat: boolean;
  traces: boolean;
  usage_stats: boolean;
  compliance: boolean;
  settings: boolean;
  deep_research: boolean;
}

const DEFAULT_ACCESS: FeatureAccess = {
  dashboard: true,
  projects: true,
  datasets: true,
  fine_tuning: true,
  templates: true,
  evaluations: true,
  models: true,
  catalog: true,
  playground: true,
  vault_chat: true,
  traces: true,
  usage_stats: true,
  compliance: true,
  settings: true,
  deep_research: true,
};

export type AccountType = 'standard' | 'vaultchat_only' | 'beta_tester' | 'demo';

interface FeatureAccessData {
  access: FeatureAccess;
  accountType: AccountType;
}

export function useFeatureAccess() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery<FeatureAccessData>({
    queryKey: ['feature-access', user?.id],
    queryFn: async () => {
      if (!user) {
        return { access: DEFAULT_ACCESS, accountType: 'standard' as AccountType };
      }

      const { data: settings, error } = await supabase
        .from('user_settings')
        .select('feature_access, account_type')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching feature access:', error);
        return { access: DEFAULT_ACCESS, accountType: 'standard' as AccountType };
      }

      // If no settings exist, user has full access
      if (!settings) {
        return { access: DEFAULT_ACCESS, accountType: 'standard' as AccountType };
      }

      const featureAccess = settings.feature_access as unknown as FeatureAccess | null;
      const accountType = (settings.account_type as AccountType) || 'standard';

      return {
        access: featureAccess || DEFAULT_ACCESS,
        accountType,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const canAccess = (feature: keyof FeatureAccess): boolean => {
    if (isLoading || !data) return true; // Allow during loading
    return data.access[feature] ?? true;
  };

  const isRestricted = data?.accountType !== 'standard' && data?.accountType !== undefined;

  return {
    canAccess,
    isRestricted,
    accountType: data?.accountType || 'standard',
    access: data?.access || DEFAULT_ACCESS,
    isLoading,
  };
}
