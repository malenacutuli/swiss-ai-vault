// supabase/functions/usage-stats/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UsageSummaryRequest {
  action: 'summary' | 'check_limit' | 'history' | 'daily' | 'models';
  start_date?: string;
  end_date?: string;
  tier?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get user from auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: UsageSummaryRequest = await req.json();
    const { action, start_date, end_date, tier } = body;

    let result;

    switch (action) {
      case 'summary':
        result = await getUsageSummary(supabase, user.id, start_date, end_date);
        break;

      case 'check_limit':
        if (!tier) {
          return new Response(
            JSON.stringify({ error: 'tier parameter required for check_limit action' }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        result = await checkUsageLimit(supabase, user.id, tier);
        break;

      case 'history':
        result = await getUsageHistory(supabase, user.id, start_date, end_date);
        break;

      case 'daily':
        result = await getDailyUsage(supabase, user.id, start_date, end_date);
        break;

      case 'models':
        result = await getModelBreakdown(supabase, user.id, start_date, end_date);
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Usage stats error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function getUsageSummary(
  supabase: any,
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<any> {
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const end = endDate || new Date().toISOString();

  const { data, error } = await supabase.rpc('get_usage_summary', {
    p_user_id: userId,
    p_start_date: start,
    p_end_date: end
  });

  if (error) throw error;
  return data;
}

async function checkUsageLimit(
  supabase: any,
  userId: string,
  tier: string
): Promise<any> {
  const { data, error } = await supabase.rpc('check_usage_limit', {
    p_user_id: userId,
    p_tier: tier
  });

  if (error) throw error;
  return data;
}

async function getUsageHistory(
  supabase: any,
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<any> {
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const end = endDate || new Date().toISOString();

  const { data, error } = await supabase
    .from('token_usage')
    .select(`
      id,
      model_id,
      run_id,
      prompt_tokens,
      completion_tokens,
      total_tokens,
      cost_usd,
      created_at
    `)
    .eq('user_id', userId)
    .gte('created_at', start)
    .lte('created_at', end)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;

  return {
    history: data,
    count: data.length,
    date_range: {
      start,
      end
    }
  };
}

async function getDailyUsage(
  supabase: any,
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<any> {
  const start = startDate
    ? new Date(startDate).toISOString().split('T')[0]
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const end = endDate
    ? new Date(endDate).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('token_usage_daily')
    .select('*')
    .eq('user_id', userId)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: false });

  if (error) throw error;

  // Calculate totals
  interface DailyTotal { total_tokens: number; total_cost_usd: number; request_count: number; }
  interface UsageDay { total_tokens?: number; total_cost_usd?: string; request_count?: number; }
  const totals = (data as UsageDay[]).reduce((acc: DailyTotal, day: UsageDay) => ({
    total_tokens: acc.total_tokens + (day.total_tokens || 0),
    total_cost_usd: acc.total_cost_usd + (parseFloat(day.total_cost_usd || '0') || 0),
    request_count: acc.request_count + (day.request_count || 0)
  }), { total_tokens: 0, total_cost_usd: 0, request_count: 0 });

  return {
    daily: data,
    totals,
    date_range: {
      start,
      end
    }
  };
}

async function getModelBreakdown(
  supabase: any,
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<any> {
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const end = endDate || new Date().toISOString();

  const { data, error } = await supabase
    .from('token_usage')
    .select('model_id, prompt_tokens, completion_tokens, total_tokens, cost_usd')
    .eq('user_id', userId)
    .gte('created_at', start)
    .lte('created_at', end);

  if (error) throw error;

  // Aggregate by model
  const modelMap = new Map();
  interface UsageRecord { model_id: string; total_tokens?: number; prompt_tokens?: number; completion_tokens?: number; cost_usd?: string; }
  (data as UsageRecord[]).forEach((record: UsageRecord) => {
    const existing = modelMap.get(record.model_id) || {
      model_id: record.model_id,
      total_tokens: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      total_cost_usd: 0,
      request_count: 0
    };

    modelMap.set(record.model_id, {
      model_id: record.model_id,
      total_tokens: existing.total_tokens + (record.total_tokens ?? 0),
      prompt_tokens: existing.prompt_tokens + (record.prompt_tokens ?? 0),
      completion_tokens: existing.completion_tokens + (record.completion_tokens ?? 0),
      total_cost_usd: existing.total_cost_usd + (parseFloat(record.cost_usd ?? '0') || 0),
      request_count: existing.request_count + 1
    });
  });

  const models = Array.from(modelMap.values())
    .sort((a, b) => b.total_tokens - a.total_tokens);

  return {
    models,
    date_range: {
      start,
      end
    }
  };
}
