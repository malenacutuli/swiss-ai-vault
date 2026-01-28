// src/hooks/usePlatformAnalytics.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AnalyticsSummary {
  total_signups: number;
  signups_today: number;
  signups_this_week: number;
  signups_this_month: number;
  active_sessions: number;
  total_sessions_today: number;
  avg_session_duration: number;
  total_events: number;
  events_today: number;
  unique_users_today: number;
  total_cost_today: number;
  total_cost_this_month: number;
}

interface RecentSignup {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  signup_method: string;
  country_code: string | null;
  city: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  device_type: string | null;
  browser: string | null;
  tier_assigned: string;
  created_at: string;
}

interface FeatureStats {
  feature_category: string;
  total_uses: number;
  unique_users: number;
  avg_uses_per_user: number;
}

interface UserCostBreakdown {
  user_id: string;
  email: string;
  total_cost: number;
  total_tokens: number;
  total_requests: number;
  top_feature: string | null;
  top_model: string | null;
}

interface UserActivityDetails {
  total_sessions: number;
  total_events: number;
  total_page_views: number;
  total_feature_uses: number;
  total_cost: number;
  total_tokens: number;
  first_seen: string | null;
  last_seen: string | null;
  avg_session_duration: number;
  feature_breakdown: Record<string, number> | null;
  recent_sessions: Array<{
    id: string;
    started_at: string;
    duration_seconds: number;
    page_count: number;
    entry_page: string;
  }> | null;
}

export function usePlatformAnalyticsSummary(days: number = 30) {
  return useQuery({
    queryKey: ['platform-analytics-summary', days],
    queryFn: async (): Promise<AnalyticsSummary> => {
      const { data, error } = await supabase.rpc('get_platform_analytics_summary', {
        p_days: days
      });
      
      if (error) throw error;
      return data as unknown as AnalyticsSummary;
    },
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000
  });
}

export function useRecentSignups(limit: number = 50) {
  return useQuery({
    queryKey: ['recent-signups', limit],
    queryFn: async (): Promise<RecentSignup[]> => {
      const { data, error } = await supabase.rpc('get_recent_signups', {
        p_limit: limit
      });
      
      if (error) throw error;
      return (data || []) as RecentSignup[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 15000
  });
}

export function useFeatureUsageStats(days: number = 30) {
  return useQuery({
    queryKey: ['feature-usage-stats', days],
    queryFn: async (): Promise<FeatureStats[]> => {
      const { data, error } = await supabase.rpc('get_feature_usage_stats', {
        p_days: days
      });
      
      if (error) throw error;
      return (data || []) as FeatureStats[];
    },
    refetchInterval: 300000, // Refresh every 5 minutes
    staleTime: 120000
  });
}

export function useUserCostBreakdown(days: number = 30) {
  return useQuery({
    queryKey: ['user-cost-breakdown', days],
    queryFn: async (): Promise<UserCostBreakdown[]> => {
      const { data, error } = await supabase.rpc('get_user_cost_breakdown', {
        p_days: days
      });
      
      if (error) throw error;
      return (data || []) as UserCostBreakdown[];
    },
    refetchInterval: 300000,
    staleTime: 120000
  });
}

export function useUserActivityDetails(userId: string | null) {
  return useQuery({
    queryKey: ['user-activity-details', userId],
    queryFn: async (): Promise<UserActivityDetails | null> => {
      if (!userId) return null;
      
      const { data, error } = await supabase.rpc('get_user_activity_details', {
        p_user_id: userId
      });
      
      if (error) throw error;
      return data as unknown as UserActivityDetails;
    },
    enabled: !!userId,
    staleTime: 60000
  });
}

// Real-time subscription for live signups
export function useRealtimeSignups(onNewSignup: (signup: RecentSignup) => void) {
  return useQuery({
    queryKey: ['realtime-signups-subscription'],
    queryFn: async () => {
      const channel = supabase
        .channel('user_signups_realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'user_signups'
          },
          (payload) => {
            onNewSignup(payload.new as RecentSignup);
          }
        )
        .subscribe();

      return { channel };
    },
    staleTime: Infinity
  });
}
