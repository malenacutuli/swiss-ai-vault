/**
 * Pool Stats Edge Function
 * Returns warm container pool statistics for monitoring
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Template distribution targets
const TEMPLATE_DISTRIBUTION: Record<string, number> = {
  'web-static': 0.30,
  'web-server': 0.25,
  'web-db-user': 0.20,
  'python-data': 0.10,
  'generic': 0.15,
};

// Pool configs per region
const POOL_CONFIGS: Record<string, { basePool: number }> = {
  'eu-central-2': { basePool: 50 },
  'eu-central-1': { basePool: 30 },
  'us-east-1': { basePool: 20 },
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const region = url.searchParams.get('region') || 'eu-central-2';

    // Get pool stats from the database function
    const { data: poolData, error: poolError } = await supabase
      .rpc('get_pool_stats', { p_region: region });

    if (poolError) {
      throw new Error(`Failed to get pool stats: ${poolError.message}`);
    }

    // Get recent metrics
    const { data: metricsData, error: metricsError } = await supabase
      .from('sandbox_pool_metrics')
      .select('*')
      .eq('region', region)
      .gte('recorded_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
      .order('recorded_at', { ascending: false })
      .limit(1000);

    if (metricsError) {
      console.warn('Failed to get metrics:', metricsError);
    }

    // Process pool data
    const basePool = POOL_CONFIGS[region]?.basePool || 50;
    const templates: Record<string, {
      warm: number;
      assigned: number;
      expired: number;
      target: number;
      hitRate: number;
    }> = {};

    let totalWarm = 0;
    let totalAssigned = 0;

    for (const row of poolData || []) {
      const distribution = TEMPLATE_DISTRIBUTION[row.template] || 0.1;
      const target = Math.ceil(basePool * distribution);
      const warm = Number(row.warm_count);
      const assigned = Number(row.assigned_count);
      const expired = Number(row.expired_count);
      const total = warm + assigned;

      templates[row.template] = {
        warm,
        assigned,
        expired,
        target,
        hitRate: total > 0 ? Math.round((warm / total) * 100) : 0,
      };

      totalWarm += warm;
      totalAssigned += assigned;
    }

    // Calculate aggregate metrics from recent data
    const warmHits = metricsData
      ?.filter(m => m.metric_type === 'warm_hit')
      .reduce((sum, m) => sum + Number(m.value), 0) || 0;

    const coldStarts = metricsData
      ?.filter(m => m.metric_type === 'cold_start')
      .reduce((sum, m) => sum + Number(m.value), 0) || 0;

    const acquisitionTimes = metricsData
      ?.filter(m => m.metric_type === 'acquisition_time_ms')
      .map(m => Number(m.value)) || [];

    const avgAcquisitionMs = acquisitionTimes.length > 0
      ? Math.round(acquisitionTimes.reduce((a, b) => a + b, 0) / acquisitionTimes.length)
      : 0;

    const totalAcquisitions = warmHits + coldStarts;
    const warmHitRate = totalAcquisitions > 0
      ? Math.round((warmHits / totalAcquisitions) * 100)
      : 0;

    const coldStartRate = totalAcquisitions > 0
      ? Math.round((coldStarts / totalAcquisitions) * 100)
      : 0;

    const stats = {
      region,
      templates,
      totalWarm,
      totalAssigned,
      totalTarget: basePool,
      metrics: {
        warmHits,
        coldStarts,
        warmHitRate,
        coldStartRate,
        avgAcquisitionMs,
        periodMinutes: 60,
      },
      health: {
        status: warmHitRate >= 90 ? 'healthy' : warmHitRate >= 70 ? 'degraded' : 'critical',
        poolUtilization: Math.round((totalWarm / basePool) * 100),
        meetsTargetSLA: avgAcquisitionMs < 500,
      },
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(stats), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Pool stats error:', error);

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
