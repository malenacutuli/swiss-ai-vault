// supabase/functions/templates/index.ts
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
        const category = url.searchParams.get('category');
        const showPublic = url.searchParams.get('public') === 'true';
        const showSystem = url.searchParams.get('system') !== 'false';

        let query = supabase
          .from('prompt_templates')
          .select('id, name, description, category, variables, model_id, is_public, is_system, use_count, avg_rating, created_at')
          .order('use_count', { ascending: false });

        if (category) query = query.eq('category', category);

        const { data, error } = await query;
        if (error) throw error;

        return new Response(JSON.stringify({ templates: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'get': {
        const templateId = url.searchParams.get('id');
        if (!templateId) throw new Error('Template ID required');

        const { data, error } = await supabase
          .from('prompt_templates')
          .select('*')
          .eq('id', templateId)
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ template: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'create': {
        if (!user) throw new Error('Authentication required');

        const body = await req.json();
        const { name, description, category, content, variables, model_id, temperature, max_tokens, is_public } = body;

        if (!name || !content) throw new Error('Name and content required');

        const { data, error } = await supabase
          .from('prompt_templates')
          .insert({
            user_id: user.id,
            name,
            description,
            category,
            content,
            variables: variables || [],
            model_id,
            temperature,
            max_tokens,
            is_public: is_public || false
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ template: data }), {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'update': {
        if (!user) throw new Error('Authentication required');

        const body = await req.json();
        const { id, ...updates } = body;

        if (!id) throw new Error('Template ID required');

        const { data, error } = await supabase
          .from('prompt_templates')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ template: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'delete': {
        if (!user) throw new Error('Authentication required');

        const templateId = url.searchParams.get('id');
        if (!templateId) throw new Error('Template ID required');

        const { error } = await supabase
          .from('prompt_templates')
          .delete()
          .eq('id', templateId)
          .eq('user_id', user.id);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'render': {
        const body = await req.json();
        const { template_id, variables } = body;

        if (!template_id) throw new Error('Template ID required');

        const { data, error } = await serviceClient.rpc('render_template', {
          p_template_id: template_id,
          p_variables: variables || []
        });

        if (error) throw error;

        return new Response(JSON.stringify({ rendered: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'use': {
        if (!user) throw new Error('Authentication required');

        const body = await req.json();
        const { template_id, variables, model_id } = body;

        if (!template_id) throw new Error('Template ID required');

        const { data, error } = await serviceClient.rpc('use_template', {
          p_template_id: template_id,
          p_user_id: user.id,
          p_variables: variables || [],
          p_model_id: model_id
        });

        if (error) throw error;

        return new Response(JSON.stringify({ rendered: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'rate': {
        if (!user) throw new Error('Authentication required');

        const body = await req.json();
        const { template_id, rating } = body;

        if (!template_id || !rating) throw new Error('Template ID and rating required');
        if (rating < 1 || rating > 5) throw new Error('Rating must be 1-5');

        // Update most recent usage with rating
        const { error } = await serviceClient
          .from('template_usage')
          .update({ rating })
          .eq('template_id', template_id)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'categories': {
        const { data, error } = await supabase
          .from('prompt_templates')
          .select('category')
          .not('category', 'is', null);

        if (error) throw error;

        const categories = [...new Set(data?.map(t => t.category))].filter(Boolean);
        return new Response(JSON.stringify({ categories }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
