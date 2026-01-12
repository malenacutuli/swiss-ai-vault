// supabase/functions/organizations/index.ts
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
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'list';

  try {
    switch (action) {
      case 'list': {
        const { data, error } = await serviceClient.rpc('get_user_organizations', {
          p_user_id: user.id
        });

        if (error) throw error;

        return new Response(JSON.stringify({ organizations: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'get': {
        const orgId = url.searchParams.get('id');
        if (!orgId) throw new Error('Organization ID required');

        const { data, error } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', orgId)
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ organization: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'create': {
        const body = await req.json();
        const { name, slug } = body;

        if (!name || !slug) throw new Error('Name and slug required');

        // Validate slug format
        if (!/^[a-z0-9-]+$/.test(slug)) {
          throw new Error('Slug must be lowercase alphanumeric with hyphens only');
        }

        const { data, error } = await serviceClient.rpc('create_organization', {
          p_name: name,
          p_slug: slug,
          p_user_id: user.id
        });

        if (error) throw error;

        return new Response(JSON.stringify({ organization_id: data }), {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'update': {
        const body = await req.json();
        const { id, name, settings, logo_url } = body;

        if (!id) throw new Error('Organization ID required');

        const { data, error } = await supabase
          .from('organizations')
          .update({
            name,
            settings,
            logo_url,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ organization: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'members': {
        const orgId = url.searchParams.get('id');
        if (!orgId) throw new Error('Organization ID required');

        const { data, error } = await serviceClient.rpc('get_organization_members', {
          p_org_id: orgId
        });

        if (error) throw error;

        return new Response(JSON.stringify({ members: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'invite': {
        const body = await req.json();
        const { organization_id, email, role } = body;

        if (!organization_id || !email) throw new Error('Organization ID and email required');

        const { data, error } = await serviceClient.rpc('invite_to_organization', {
          p_org_id: organization_id,
          p_email: email,
          p_role: role || 'member',
          p_invited_by: user.id
        });

        if (error) throw error;

        // TODO: Send invite email
        return new Response(JSON.stringify({ invite_token: data }), {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'accept_invite': {
        const body = await req.json();
        const { token } = body;

        if (!token) throw new Error('Invite token required');

        const { data, error } = await serviceClient.rpc('accept_organization_invite', {
          p_token: token,
          p_user_id: user.id
        });

        if (error) throw error;

        return new Response(JSON.stringify({ organization_id: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'remove_member': {
        const body = await req.json();
        const { organization_id, user_id } = body;

        if (!organization_id || !user_id) throw new Error('Organization ID and user ID required');

        // Verify caller is admin
        const { data: caller } = await supabase
          .from('organization_members')
          .select('role')
          .eq('organization_id', organization_id)
          .eq('user_id', user.id)
          .single();

        if (!caller || !['owner', 'admin'].includes(caller.role)) {
          throw new Error('Not authorized');
        }

        // Prevent removing owner
        const { data: target } = await serviceClient
          .from('organization_members')
          .select('role')
          .eq('organization_id', organization_id)
          .eq('user_id', user_id)
          .single();

        if (target?.role === 'owner') {
          throw new Error('Cannot remove organization owner');
        }

        const { error } = await serviceClient
          .from('organization_members')
          .update({ is_active: false })
          .eq('organization_id', organization_id)
          .eq('user_id', user_id);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
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
