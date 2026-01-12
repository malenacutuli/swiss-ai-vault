// supabase/functions/scheduled-tasks/index.ts
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

  const authHeader = req.headers.get('Authorization');

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader || '' } } }
  );

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: { user } } = await supabase.auth.getUser();

  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'list';

  try {
    switch (action) {
      case 'list': {
        if (!user) throw new Error('Unauthorized');

        const { data, error } = await supabase
          .from('scheduled_tasks')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        return new Response(JSON.stringify({ tasks: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'create': {
        if (!user) throw new Error('Unauthorized');

        const body = await req.json();
        const { name, description, prompt, schedule, timezone, config } = body;

        if (!name || !prompt || !schedule) {
          throw new Error('Name, prompt, and schedule are required');
        }

        const { data, error } = await supabase
          .from('scheduled_tasks')
          .insert({
            user_id: user.id,
            name,
            description,
            prompt,
            schedule,
            timezone: timezone || 'UTC',
            config: config || {}
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
        if (!user) throw new Error('Unauthorized');

        const body = await req.json();
        const { id, ...updates } = body;

        if (!id) throw new Error('Task ID required');

        const { data, error } = await supabase
          .from('scheduled_tasks')
          .update(updates)
          .eq('id', id)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ task: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'delete': {
        if (!user) throw new Error('Unauthorized');

        const taskId = url.searchParams.get('id');
        if (!taskId) throw new Error('Task ID required');

        const { error } = await supabase
          .from('scheduled_tasks')
          .delete()
          .eq('id', taskId)
          .eq('user_id', user.id);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'toggle': {
        if (!user) throw new Error('Unauthorized');

        const body = await req.json();
        const { id, is_active } = body;

        if (!id) throw new Error('Task ID required');

        const { data, error } = await supabase
          .from('scheduled_tasks')
          .update({ is_active })
          .eq('id', id)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ task: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Called by pg_cron or external scheduler
      case 'trigger': {
        // Verify this is from trusted source (internal call)
        const triggerSecret = req.headers.get('x-trigger-secret');
        if (triggerSecret !== Deno.env.get('SCHEDULER_SECRET')) {
          throw new Error('Unauthorized trigger');
        }

        // Find due tasks
        const { data: dueTasks, error: queryError } = await serviceClient
          .from('scheduled_tasks')
          .select('*')
          .eq('is_active', true)
          .lte('next_run_at', new Date().toISOString());

        if (queryError) throw queryError;

        const results = [];

        for (const task of dueTasks || []) {
          try {
            // Create agent task
            const { data: runData } = await serviceClient.functions.invoke('agent-execute', {
              body: {
                action: 'create',
                prompt: task.prompt,
                config: {
                  ...task.config,
                  scheduled_task_id: task.id
                }
              }
            });

            // Start the task
            await serviceClient.functions.invoke('agent-execute', {
              body: {
                action: 'start',
                run_id: runData.run_id
              }
            });

            // Record the run
            await serviceClient.from('scheduled_task_runs').insert({
              scheduled_task_id: task.id,
              run_id: runData.run_id,
              status: 'started'
            });

            // Update scheduled task
            await serviceClient
              .from('scheduled_tasks')
              .update({
                last_run_at: new Date().toISOString(),
                last_run_id: runData.run_id,
                last_run_status: 'started',
                run_count: task.run_count + 1
              })
              .eq('id', task.id);

            results.push({ task_id: task.id, run_id: runData.run_id, status: 'started' });
          } catch (err: any) {
            results.push({ task_id: task.id, error: err.message });
          }
        }

        return new Response(JSON.stringify({ triggered: results.length, results }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
