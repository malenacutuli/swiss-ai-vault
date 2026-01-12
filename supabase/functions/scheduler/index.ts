// supabase/functions/scheduler/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'run';

  try {
    switch (action) {
      case 'run': {
        // Get due tasks
        const { data: tasks, error } = await serviceClient.rpc('get_due_tasks', {
          p_limit: 10
        });

        if (error) throw error;

        const results = [];

        for (const task of tasks || []) {
          const startTime = Date.now();

          try {
            let result;

            switch (task.task_type) {
              case 'agent':
                // Trigger agent task
                const agentRes = await serviceClient.functions.invoke('agent-execute', {
                  body: {
                    action: 'create',
                    prompt: task.config.prompt || '',
                    config: task.config
                  }
                });

                if (agentRes.error) throw agentRes.error;

                // Start the task
                await serviceClient.functions.invoke('agent-execute', {
                  body: {
                    action: 'start',
                    run_id: agentRes.data.run_id
                  }
                });

                result = { run_id: agentRes.data.run_id };
                break;

              case 'webhook':
                // Call webhook URL
                const webhookRes = await fetch(task.config.url, {
                  method: task.config.method || 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(task.config.headers || {})
                  },
                  body: task.config.body ? JSON.stringify(task.config.body) : undefined
                });

                const webhookData = await webhookRes.text();
                result = {
                  status: webhookRes.status,
                  response: webhookData.slice(0, 1000) // Limit size
                };

                if (!webhookRes.ok) {
                  throw new Error(`Webhook failed: ${webhookRes.status} ${webhookData}`);
                }
                break;

              case 'email':
                // Send scheduled email
                // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
                result = {
                  sent: true,
                  to: task.config.to,
                  subject: task.config.subject,
                  message: 'Email service not yet configured'
                };
                break;

              case 'backup':
                // Trigger backup
                // TODO: Implement backup logic (database export, file backup, etc.)
                result = {
                  backed_up: true,
                  target: task.config.target || 'unknown',
                  message: 'Backup service not yet configured'
                };
                break;

              default:
                throw new Error(`Unknown task type: ${task.task_type}`);
            }

            const duration = Date.now() - startTime;

            // Record successful execution
            await serviceClient.rpc('record_task_execution', {
              p_task_id: task.task_id,
              p_status: 'completed',
              p_result: result,
              p_duration_ms: duration
            });

            results.push({
              task_id: task.task_id,
              status: 'completed',
              duration_ms: duration
            });

          } catch (taskError: any) {
            const duration = Date.now() - startTime;

            // Record failed execution
            await serviceClient.rpc('record_task_execution', {
              p_task_id: task.task_id,
              p_status: 'failed',
              p_error_message: taskError.message,
              p_duration_ms: duration
            });

            results.push({
              task_id: task.task_id,
              status: 'failed',
              error: taskError.message,
              duration_ms: duration
            });
          }
        }

        return new Response(JSON.stringify({
          executed: results.length,
          results
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'list': {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Unauthorized');

        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );

        const { data, error } = await supabase
          .from('scheduled_tasks')
          .select(`
            *,
            task_executions(
              id,
              started_at,
              completed_at,
              status,
              duration_ms,
              error_message
            )
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;

        return new Response(JSON.stringify({ tasks: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'summary': {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Unauthorized');

        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );

        const { data, error } = await supabase
          .from('task_execution_summary')
          .select('*')
          .order('last_run_at', { ascending: false, nullsFirst: false });

        if (error) throw error;

        return new Response(JSON.stringify({ summary: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'create': {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Unauthorized');

        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Unauthorized');

        const body = await req.json();
        const { name, description, task_type, config, schedule, timezone } = body;

        if (!name || !task_type || !config || !schedule) {
          throw new Error('name, task_type, config, and schedule are required');
        }

        const { data, error } = await supabase
          .from('scheduled_tasks')
          .insert({
            user_id: user.id,
            name,
            description,
            task_type,
            config,
            schedule,
            timezone: timezone || 'UTC',
            prompt: config.prompt || '' // For agent tasks
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ task: data }), {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'update': {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Unauthorized');

        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );

        const body = await req.json();
        const { id, ...updates } = body;

        if (!id) throw new Error('Task ID required');

        const { data, error } = await supabase
          .from('scheduled_tasks')
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ task: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'toggle': {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Unauthorized');

        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );

        const body = await req.json();
        const { id, is_active } = body;

        if (!id || is_active === undefined) {
          throw new Error('id and is_active required');
        }

        const { data, error } = await supabase
          .from('scheduled_tasks')
          .update({ is_active })
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ task: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'delete': {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Unauthorized');

        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );

        const taskId = url.searchParams.get('id');
        if (!taskId) throw new Error('Task ID required');

        const { error } = await supabase
          .from('scheduled_tasks')
          .delete()
          .eq('id', taskId);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Scheduler error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
