// src/hooks/useAdminStats.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AdminStats {
  systemHealth: {
    overall_status: string;
    checks: Array<{
      service: string;
      status: string;
      latency_ms: number;
      message?: string;
    }>;
  } | null;
  cacheStats: {
    total_hits: number;
    total_misses: number;
    hit_rate: number;
    tokens_saved: number;
    cost_saved_usd: number;
  } | null;
  modelHealth: Array<{
    id: string;
    provider: string;
    display_name: string;
    health: { status: string; latency_ms: number };
  }> | null;
}

export function useAdminStats() {
  const [stats, setStats] = useState<AdminStats>({
    systemHealth: null,
    cacheStats: null,
    modelHealth: null
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch system health
      const healthRes = await supabase.functions.invoke('swiss-health', {
        body: null
      });

      // Fetch cache stats
      const cacheRes = await supabase.functions.invoke('cache-stats', {
        body: null
      });

      // Fetch model health
      const modelRes = await supabase.functions.invoke('model-registry', {
        body: null,
        headers: {}
      });

      setStats({
        systemHealth: healthRes.data || null,
        cacheStats: cacheRes.data?.stats || null,
        modelHealth: modelRes.data?.models || null
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, isLoading, error, refresh: fetchStats };
}

export function useOrgAnalytics(orgId: string | null) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [engagement, setEngagement] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    if (!orgId) return;

    setIsLoading(true);
    try {
      const [analyticsRes, engagementRes] = await Promise.all([
        supabase.functions.invoke('analytics', {
          body: null,
          headers: {}
        }),
        supabase.functions.invoke('analytics', {
          body: null,
          headers: {}
        })
      ]);

      setAnalytics(analyticsRes.data?.analytics || null);
      setEngagement(engagementRes.data?.engagement || null);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return { analytics, engagement, isLoading, refresh: fetchAnalytics };
}
