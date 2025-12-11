import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ADMIN_SECRET = Deno.env.get("ADMIN_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin secret
    const adminSecret = req.headers.get("x-admin-secret");
    if (!ADMIN_SECRET || adminSecret !== ADMIN_SECRET) {
      console.error("Unauthorized: Invalid or missing admin secret");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, password, accessType = "vaultchat_only" } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Create user with auto-confirmed email
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      console.error("Auth error creating user:", authError);
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;
    console.log(`Created user ${userId} with email ${email}`);

    // Define feature access by type
    const featureAccess: Record<string, Record<string, boolean>> = {
      vaultchat_only: {
        dashboard: false,
        projects: false,
        datasets: false,
        fine_tuning: false,
        templates: false,
        evaluations: false,
        models: false,
        catalog: false,
        playground: false,
        vault_chat: true,
        traces: false,
        usage_stats: false,
        compliance: false,
        settings: true,
        deep_research: true,
      },
      beta_tester: {
        dashboard: true,
        projects: false,
        datasets: false,
        fine_tuning: false,
        templates: false,
        evaluations: false,
        models: false,
        catalog: true,
        playground: true,
        vault_chat: true,
        traces: false,
        usage_stats: true,
        compliance: false,
        settings: true,
        deep_research: true,
      },
      demo: {
        dashboard: true,
        projects: true,
        datasets: true,
        fine_tuning: false,
        templates: true,
        evaluations: true,
        models: true,
        catalog: true,
        playground: true,
        vault_chat: true,
        traces: true,
        usage_stats: true,
        compliance: true,
        settings: true,
        deep_research: true,
      },
    };

    // Insert user settings with feature access
    const { error: settingsError } = await supabase.from("user_settings").upsert({
      user_id: userId,
      account_type: accessType,
      feature_access: featureAccess[accessType] || featureAccess.vaultchat_only,
    });

    if (settingsError) {
      console.error("Error setting user settings:", settingsError);
    }

    console.log(`User ${userId} configured with accessType: ${accessType}`);

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: userId,
          email,
          accessType,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error creating test user:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
