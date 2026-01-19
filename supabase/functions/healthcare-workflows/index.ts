// Healthcare Workflows Edge Function
// Manages prior auths, claims, appeals, and tasks

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

interface RequestBody {
  action: string;
  data?: Record<string, any>;
  id?: string;
  filters?: Record<string, any>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user auth
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check subscription for healthcare access
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('tier, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    const hasAccess = subscription && ['pro', 'premium', 'enterprise'].includes(subscription.tier);

    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: 'Healthcare features require Pro subscription or higher' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const { action, data, id, filters }: RequestBody = await req.json();

    // Route actions
    switch (action) {
      // ============== PRIOR AUTHORIZATIONS ==============
      case 'prior_auths.list': {
        let query = supabase
          .from('healthcare_prior_auths')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (filters?.status) {
          query = query.eq('status', filters.status);
        }
        if (filters?.urgency) {
          query = query.eq('urgency', filters.urgency);
        }
        if (filters?.limit) {
          query = query.limit(filters.limit);
        }

        const { data: priorAuths, error } = await query;

        if (error) throw error;
        return jsonResponse({ prior_auths: priorAuths });
      }

      case 'prior_auths.get': {
        if (!id) throw new Error('ID required');

        const { data: priorAuth, error } = await supabase
          .from('healthcare_prior_auths')
          .select(`
            *,
            history:healthcare_prior_auth_history(*)
          `)
          .eq('id', id)
          .eq('user_id', user.id)
          .single();

        if (error) throw error;
        return jsonResponse({ prior_auth: priorAuth });
      }

      case 'prior_auths.create': {
        if (!data) throw new Error('Data required');

        // Generate reference number
        const refNumber = `PA-${Date.now().toString(36).toUpperCase()}`;

        const { data: priorAuth, error } = await supabase
          .from('healthcare_prior_auths')
          .insert({
            ...data,
            user_id: user.id,
            reference_number: refNumber,
            status: 'draft'
          })
          .select()
          .single();

        if (error) throw error;
        return jsonResponse({ prior_auth: priorAuth }, 201);
      }

      case 'prior_auths.update': {
        if (!id || !data) throw new Error('ID and data required');

        const { data: priorAuth, error } = await supabase
          .from('healthcare_prior_auths')
          .update({
            ...data,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;
        return jsonResponse({ prior_auth: priorAuth });
      }

      case 'prior_auths.submit_for_ai_review': {
        if (!id) throw new Error('ID required');

        // Update status to pending_ai_review
        const { data: priorAuth, error } = await supabase
          .from('healthcare_prior_auths')
          .update({
            status: 'pending_ai_review',
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .eq('user_id', user.id)
          .eq('status', 'draft') // Can only submit drafts
          .select()
          .single();

        if (error) throw error;

        // Queue AI review (will be processed by healthcare-query)
        // In production, this would trigger a background job
        return jsonResponse({
          prior_auth: priorAuth,
          message: 'Submitted for AI review. Check back for results.'
        });
      }

      case 'prior_auths.delete': {
        if (!id) throw new Error('ID required');

        const { error } = await supabase
          .from('healthcare_prior_auths')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id)
          .in('status', ['draft', 'cancelled']); // Can only delete drafts or cancelled

        if (error) throw error;
        return jsonResponse({ success: true });
      }

      // ============== CLAIMS ==============
      case 'claims.list': {
        let query = supabase
          .from('healthcare_claims')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (filters?.status) {
          query = query.eq('status', filters.status);
        }
        if (filters?.limit) {
          query = query.limit(filters.limit);
        }

        const { data: claims, error } = await query;

        if (error) throw error;
        return jsonResponse({ claims });
      }

      case 'claims.get': {
        if (!id) throw new Error('ID required');

        const { data: claim, error } = await supabase
          .from('healthcare_claims')
          .select('*')
          .eq('id', id)
          .eq('user_id', user.id)
          .single();

        if (error) throw error;
        return jsonResponse({ claim });
      }

      case 'claims.get_denied': {
        const { data: claims, error } = await supabase
          .from('healthcare_claims')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'denied')
          .order('adjudicated_at', { ascending: false });

        if (error) throw error;
        return jsonResponse({ claims });
      }

      case 'claims.create': {
        if (!data) throw new Error('Data required');

        const claimNumber = `CLM-${Date.now().toString(36).toUpperCase()}`;

        const { data: claim, error } = await supabase
          .from('healthcare_claims')
          .insert({
            ...data,
            user_id: user.id,
            claim_number: claimNumber,
            status: 'draft'
          })
          .select()
          .single();

        if (error) throw error;
        return jsonResponse({ claim }, 201);
      }

      case 'claims.update': {
        if (!id || !data) throw new Error('ID and data required');

        const { data: claim, error } = await supabase
          .from('healthcare_claims')
          .update({
            ...data,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;
        return jsonResponse({ claim });
      }

      // ============== APPEALS ==============
      case 'appeals.list': {
        let query = supabase
          .from('healthcare_appeals')
          .select(`
            *,
            claim:healthcare_claims(claim_number, payer_name),
            prior_auth:healthcare_prior_auths(reference_number, payer_name)
          `)
          .eq('user_id', user.id)
          .order('deadline', { ascending: true });

        if (filters?.status) {
          query = query.eq('status', filters.status);
        }
        if (filters?.upcoming_deadlines) {
          const futureDate = new Date();
          futureDate.setDate(futureDate.getDate() + 30);
          query = query
            .lte('deadline', futureDate.toISOString().split('T')[0])
            .not('status', 'in', '("approved","denied")');
        }

        const { data: appeals, error } = await query;

        if (error) throw error;
        return jsonResponse({ appeals });
      }

      case 'appeals.get': {
        if (!id) throw new Error('ID required');

        const { data: appeal, error } = await supabase
          .from('healthcare_appeals')
          .select(`
            *,
            claim:healthcare_claims(*),
            prior_auth:healthcare_prior_auths(*),
            documents:healthcare_workflow_documents(*)
          `)
          .eq('id', id)
          .eq('user_id', user.id)
          .single();

        if (error) throw error;
        return jsonResponse({ appeal });
      }

      case 'appeals.create': {
        if (!data) throw new Error('Data required');

        // Set default deadline if not provided (60 days for most payers)
        const deadline = data.deadline || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const { data: appeal, error } = await supabase
          .from('healthcare_appeals')
          .insert({
            ...data,
            user_id: user.id,
            deadline,
            status: 'draft'
          })
          .select()
          .single();

        if (error) throw error;
        return jsonResponse({ appeal }, 201);
      }

      case 'appeals.update': {
        if (!id || !data) throw new Error('ID and data required');

        const { data: appeal, error } = await supabase
          .from('healthcare_appeals')
          .update({
            ...data,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;
        return jsonResponse({ appeal });
      }

      case 'appeals.submit': {
        if (!id) throw new Error('ID required');

        const { data: appeal, error } = await supabase
          .from('healthcare_appeals')
          .update({
            status: 'submitted',
            submitted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .eq('user_id', user.id)
          .in('status', ['draft', 'pending_review'])
          .select()
          .single();

        if (error) throw error;
        return jsonResponse({ appeal });
      }

      // ============== TASKS ==============
      case 'tasks.list': {
        let query = supabase
          .from('healthcare_tasks')
          .select(`
            *,
            prior_auth:healthcare_prior_auths(reference_number, payer_name, status),
            claim:healthcare_claims(claim_number, payer_name, status),
            appeal:healthcare_appeals(id, status, deadline)
          `)
          .eq('user_id', user.id)
          .order('priority', { ascending: true })
          .order('due_date', { ascending: true });

        if (filters?.status) {
          query = query.eq('status', filters.status);
        } else {
          // Default: only show pending/in_progress tasks
          query = query.in('status', ['pending', 'in_progress', 'blocked']);
        }
        if (filters?.task_type) {
          query = query.eq('task_type', filters.task_type);
        }
        if (filters?.limit) {
          query = query.limit(filters.limit);
        }

        const { data: tasks, error } = await query;

        if (error) throw error;
        return jsonResponse({ tasks });
      }

      case 'tasks.complete': {
        if (!id) throw new Error('ID required');

        const { data: task, error } = await supabase
          .from('healthcare_tasks')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;
        return jsonResponse({ task });
      }

      case 'tasks.update': {
        if (!id || !data) throw new Error('ID and data required');

        const { data: task, error } = await supabase
          .from('healthcare_tasks')
          .update({
            ...data,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;
        return jsonResponse({ task });
      }

      // ============== DOCUMENTS ==============
      case 'documents.list': {
        let query = supabase
          .from('healthcare_workflow_documents')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (filters?.prior_auth_id) {
          query = query.eq('prior_auth_id', filters.prior_auth_id);
        }
        if (filters?.claim_id) {
          query = query.eq('claim_id', filters.claim_id);
        }
        if (filters?.appeal_id) {
          query = query.eq('appeal_id', filters.appeal_id);
        }
        if (filters?.document_type) {
          query = query.eq('document_type', filters.document_type);
        }

        const { data: documents, error } = await query;

        if (error) throw error;
        return jsonResponse({ documents });
      }

      case 'documents.create': {
        if (!data) throw new Error('Data required');

        const { data: document, error } = await supabase
          .from('healthcare_workflow_documents')
          .insert({
            ...data,
            user_id: user.id
          })
          .select()
          .single();

        if (error) throw error;
        return jsonResponse({ document }, 201);
      }

      // ============== DASHBOARD ==============
      case 'dashboard.stats': {
        // Get counts for dashboard
        const [
          { count: totalPriorAuths },
          { count: pendingPriorAuths },
          { count: deniedClaims },
          { count: pendingTasks },
          { data: upcomingDeadlines }
        ] = await Promise.all([
          supabase
            .from('healthcare_prior_auths')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id),
          supabase
            .from('healthcare_prior_auths')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .in('status', ['draft', 'pending_ai_review', 'ai_reviewed', 'pending_submission', 'submitted', 'in_review']),
          supabase
            .from('healthcare_claims')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('status', 'denied'),
          supabase
            .from('healthcare_tasks')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('status', 'pending'),
          supabase
            .from('healthcare_appeals')
            .select('id, deadline, status')
            .eq('user_id', user.id)
            .not('status', 'in', '("approved","denied")')
            .lte('deadline', new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            .order('deadline', { ascending: true })
            .limit(5)
        ]);

        return jsonResponse({
          stats: {
            total_prior_auths: totalPriorAuths || 0,
            pending_prior_auths: pendingPriorAuths || 0,
            denied_claims: deniedClaims || 0,
            pending_tasks: pendingTasks || 0,
            upcoming_deadlines: upcomingDeadlines || []
          }
        });
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('Healthcare workflows error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function jsonResponse(data: any, status = 200) {
  return new Response(
    JSON.stringify(data),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
