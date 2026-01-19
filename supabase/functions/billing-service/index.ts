// supabase/functions/billing-service/index.ts
// Billing Service for Manus Parity - Credit management, reservations, charging

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Action types
type BillingAction =
  | 'get_balance'
  | 'get_account'
  | 'reserve_credits'
  | 'charge_credits'
  | 'refund_credits'
  | 'add_credits'
  | 'get_usage'
  | 'get_transactions'
  | 'get_pricing'
  | 'check_rate_limit';

interface BillingRequest {
  action: BillingAction;
  // Reserve params
  run_id?: string;
  task_type?: string;
  estimated_tokens?: number;
  // Charge params
  actual_tokens?: number;
  execution_seconds?: number;
  step_count?: number;
  // Refund params
  reason?: string;
  // Add credits params
  amount?: number;
  description?: string;
  idempotency_key?: string;
  // Usage params
  period?: 'daily' | 'weekly' | 'monthly';
  // Transactions params
  limit?: number;
  offset?: number;
}

interface BillingAccount {
  id: string;
  user_id: string;
  balance: number;
  reserved_balance: number;
  plan_type: string;
  plan_credits_monthly: number;
  spending_limit?: number;
  rate_limit_per_hour: number;
  rate_limit_per_day: number;
  is_active: boolean;
}

interface CreditPricing {
  task_type: string;
  base_cost: number;
  cost_per_token: number;
  cost_per_second: number;
  cost_per_step: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Authenticate
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const params: BillingRequest = await req.json();

    if (!params.action) {
      return new Response(
        JSON.stringify({ success: false, error: 'action is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[billing-service] User ${user.id} action: ${params.action}`);

    let result: any;

    switch (params.action) {
      // ===== GET BALANCE =====
      case 'get_balance': {
        const account = await getOrCreateAccount(supabase, user.id);

        result = {
          balance: account.balance,
          reserved: account.reserved_balance,
          available: account.balance - account.reserved_balance,
          plan_type: account.plan_type,
          is_active: account.is_active,
        };
        break;
      }

      // ===== GET ACCOUNT =====
      case 'get_account': {
        const account = await getOrCreateAccount(supabase, user.id);

        result = {
          account: {
            id: account.id,
            balance: account.balance,
            reserved_balance: account.reserved_balance,
            available: account.balance - account.reserved_balance,
            plan_type: account.plan_type,
            plan_credits_monthly: account.plan_credits_monthly,
            spending_limit: account.spending_limit,
            rate_limit_per_hour: account.rate_limit_per_hour,
            rate_limit_per_day: account.rate_limit_per_day,
            is_active: account.is_active,
          },
        };
        break;
      }

      // ===== RESERVE CREDITS =====
      case 'reserve_credits': {
        if (!params.run_id || !params.task_type) {
          throw new Error('run_id and task_type are required');
        }

        // Call database function
        const { data, error } = await supabase.rpc('reserve_credits', {
          p_user_id: user.id,
          p_run_id: params.run_id,
          p_task_type: params.task_type,
          p_estimated_tokens: params.estimated_tokens || 1000,
        });

        if (error) throw error;

        result = data;
        break;
      }

      // ===== CHARGE CREDITS =====
      case 'charge_credits': {
        if (!params.run_id) {
          throw new Error('run_id is required');
        }

        // Call database function
        const { data, error } = await supabase.rpc('charge_credits', {
          p_run_id: params.run_id,
          p_actual_tokens: params.actual_tokens || 0,
          p_execution_seconds: params.execution_seconds || 0,
          p_step_count: params.step_count || 0,
        });

        if (error) throw error;

        result = data;
        break;
      }

      // ===== REFUND CREDITS =====
      case 'refund_credits': {
        if (!params.run_id) {
          throw new Error('run_id is required');
        }

        // Call database function
        const { data, error } = await supabase.rpc('refund_credits', {
          p_run_id: params.run_id,
          p_reason: params.reason || 'user_request',
        });

        if (error) throw error;

        result = data;
        break;
      }

      // ===== ADD CREDITS =====
      case 'add_credits': {
        if (!params.amount || params.amount <= 0) {
          throw new Error('Positive amount is required');
        }

        const account = await getOrCreateAccount(supabase, user.id);

        // Check idempotency
        if (params.idempotency_key) {
          const { data: existing } = await supabase
            .from('billing_ledger')
            .select('id')
            .eq('idempotency_key', params.idempotency_key)
            .single();

          if (existing) {
            result = { success: true, message: 'Already processed', idempotent: true };
            break;
          }
        }

        // Add credits
        const { error: updateError } = await supabase
          .from('billing_accounts')
          .update({
            balance: account.balance + params.amount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', account.id);

        if (updateError) throw updateError;

        // Record in ledger
        await supabase.from('billing_ledger').insert({
          account_id: account.id,
          user_id: user.id,
          transaction_type: 'purchase',
          credits_amount: params.amount,
          balance_before: account.balance,
          balance_after: account.balance + params.amount,
          description: params.description || 'Credit purchase',
          idempotency_key: params.idempotency_key,
        });

        result = {
          success: true,
          credits_added: params.amount,
          new_balance: account.balance + params.amount,
        };
        break;
      }

      // ===== GET USAGE =====
      case 'get_usage': {
        const account = await getOrCreateAccount(supabase, user.id);
        const period = params.period || 'daily';

        // Calculate period bounds
        let periodStart: Date;
        const periodEnd = new Date();

        switch (period) {
          case 'weekly':
            periodStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'monthly':
            periodStart = new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          default:
            periodStart = new Date(periodEnd.getTime() - 24 * 60 * 60 * 1000);
        }

        // Get usage from ledger
        const { data: transactions } = await supabase
          .from('billing_ledger')
          .select('*')
          .eq('account_id', account.id)
          .eq('transaction_type', 'charge')
          .gte('created_at', periodStart.toISOString())
          .lte('created_at', periodEnd.toISOString());

        // Aggregate usage
        let totalCredits = 0;
        let totalRuns = 0;
        const byType: Record<string, { runs: number; credits: number }> = {};

        for (const tx of transactions || []) {
          totalCredits += Math.abs(tx.credits_amount);
          totalRuns++;

          const taskType = tx.metadata?.task_type || 'unknown';
          if (!byType[taskType]) {
            byType[taskType] = { runs: 0, credits: 0 };
          }
          byType[taskType].runs++;
          byType[taskType].credits += Math.abs(tx.credits_amount);
        }

        result = {
          period,
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
          total_runs: totalRuns,
          total_credits: totalCredits,
          by_type: byType,
        };
        break;
      }

      // ===== GET TRANSACTIONS =====
      case 'get_transactions': {
        const account = await getOrCreateAccount(supabase, user.id);
        const limit = Math.min(params.limit || 50, 100);
        const offset = params.offset || 0;

        const { data: transactions, error } = await supabase
          .from('billing_ledger')
          .select('*')
          .eq('account_id', account.id)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) throw error;

        result = {
          transactions: (transactions || []).map(tx => ({
            id: tx.id,
            type: tx.transaction_type,
            amount: tx.credits_amount,
            balance_after: tx.balance_after,
            description: tx.description,
            run_id: tx.run_id,
            created_at: tx.created_at,
          })),
          limit,
          offset,
        };
        break;
      }

      // ===== GET PRICING =====
      case 'get_pricing': {
        const { data: pricing, error } = await supabase
          .from('credit_pricing')
          .select('*')
          .eq('is_active', true)
          .order('task_type');

        if (error) throw error;

        result = {
          pricing: (pricing || []).map(p => ({
            task_type: p.task_type,
            base_cost: p.base_cost,
            cost_per_token: p.cost_per_token,
            cost_per_second: p.cost_per_second,
            cost_per_step: p.cost_per_step,
            description: p.description,
          })),
        };
        break;
      }

      // ===== CHECK RATE LIMIT =====
      case 'check_rate_limit': {
        const account = await getOrCreateAccount(supabase, user.id);

        // Check hourly limit
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { count: hourlyCount } = await supabase
          .from('agent_runs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', hourAgo);

        // Check daily limit
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count: dailyCount } = await supabase
          .from('agent_runs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', dayAgo);

        const hourlyAllowed = (hourlyCount || 0) < account.rate_limit_per_hour;
        const dailyAllowed = (dailyCount || 0) < account.rate_limit_per_day;
        const allowed = hourlyAllowed && dailyAllowed && account.is_active;

        result = {
          allowed,
          hourly: {
            used: hourlyCount || 0,
            limit: account.rate_limit_per_hour,
            remaining: Math.max(0, account.rate_limit_per_hour - (hourlyCount || 0)),
          },
          daily: {
            used: dailyCount || 0,
            limit: account.rate_limit_per_day,
            remaining: Math.max(0, account.rate_limit_per_day - (dailyCount || 0)),
          },
          reason: !allowed
            ? (!account.is_active
                ? 'Account suspended'
                : !hourlyAllowed
                ? 'Hourly rate limit exceeded'
                : 'Daily rate limit exceeded')
            : null,
        };
        break;
      }

      default:
        throw new Error(`Unknown action: ${params.action}`);
    }

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[billing-service] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper: Get or create billing account
async function getOrCreateAccount(supabase: any, userId: string): Promise<BillingAccount> {
  // Try to get existing account
  const { data: existing } = await supabase
    .from('billing_accounts')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (existing) return existing;

  // Create new account with free tier credits
  const { data: newAccount, error } = await supabase
    .from('billing_accounts')
    .insert({
      user_id: userId,
      balance: 10000000, // 10k credits in millicredits
      plan_type: 'free',
      plan_credits_monthly: 10000000,
      plan_reset_at: getNextMonthStart(),
    })
    .select()
    .single();

  if (error) throw error;

  // Record initial credits in ledger
  await supabase.from('billing_ledger').insert({
    account_id: newAccount.id,
    user_id: userId,
    transaction_type: 'plan_credit',
    credits_amount: 10000000,
    balance_before: 0,
    balance_after: 10000000,
    description: 'Initial free tier credits',
  });

  return newAccount;
}

// Helper: Get start of next month
function getNextMonthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
}
