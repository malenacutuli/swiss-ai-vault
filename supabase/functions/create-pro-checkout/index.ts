import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Product price IDs for different tiers
const TIER_PRICES: Record<string, { priceId: string; name: string }> = {
  'vault_pro': { priceId: 'price_1Sd2izCAKg7jOuBKAeTfXgcp', name: 'Vault Chat Private Edition' },
  'ghost_pro': { priceId: 'price_ghost_pro_monthly', name: 'Ghost Pro' },
  'swissvault_pro': { priceId: 'price_swissvault_pro_monthly', name: 'SwissVault Pro' },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    // Parse request body to get tier (defaults to vault_pro for backward compatibility)
    let tier = 'vault_pro';
    try {
      const body = await req.json();
      if (body.tier && TIER_PRICES[body.tier]) {
        tier = body.tier;
      }
    } catch {
      // No body or invalid JSON, use default tier
    }

    const tierConfig = TIER_PRICES[tier];
    console.log(`[create-pro-checkout] Creating checkout for tier: ${tier}`);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Determine success/cancel URLs based on tier
    const successUrl = tier.startsWith('ghost') || tier === 'swissvault_pro'
      ? `${req.headers.get("origin")}/ghost?subscription=success`
      : `${req.headers.get("origin")}/dashboard?subscription=success`;
    
    const cancelUrl = tier.startsWith('ghost') || tier === 'swissvault_pro'
      ? `${req.headers.get("origin")}/ghost?subscription=cancelled`
      : `${req.headers.get("origin")}/#pricing`;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: tierConfig.priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: user.id,
        tier: tier,
        type: 'pro_subscription',
      },
    });

    console.log("[create-pro-checkout] Created checkout session:", session.id);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[create-pro-checkout] Checkout error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
