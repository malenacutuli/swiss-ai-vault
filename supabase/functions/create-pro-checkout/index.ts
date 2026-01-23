import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { getAppBaseUrl } from "../_shared/domains.ts";

// Product price IDs for different tiers
const TIER_PRICES: Record<string, { priceId: string; name: string }> = {
  'ghost_pro': { priceId: 'price_1Sk87oCAKg7jOuBKiPEBZCFY', name: 'Ghost Pro' },  // $18/mo
  'ghost_pro_annual': { priceId: 'price_1Sk88kCAKg7jOuBK4FV2xhAe', name: 'Ghost Pro Annual' },  // $151.20/yr
  'swissvault_pro': { priceId: 'price_1ScM8JCAKg7jOuBKkUh2zShm', name: 'SwissVault Pro' },  // $49/mo
  'swissvault_pro_annual': { priceId: 'price_1SsnVsCAKg7jOuBKrxS712W7', name: 'SwissVault Pro Annual' },  // $490/yr
  'vault_pro': { priceId: 'price_1ScM8JCAKg7jOuBKkUh2zShm', name: 'SwissVault Pro' },  // Alias for backward compat
  'vault_pro_annual': { priceId: 'price_1SsnVsCAKg7jOuBKrxS712W7', name: 'SwissVault Pro Annual' },  // Alias
};

serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  
  const corsHeaders = getCorsHeaders(req);

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

    // Parse request body to get tier and billing period
    let tier = 'ghost_pro';
    let billingPeriod = 'monthly';
    try {
      const body = await req.json();
      if (body.tier) {
        tier = body.tier;
      }
      if (body.billing_period === 'annual') {
        billingPeriod = 'annual';
      }
    } catch {
      // No body or invalid JSON, use defaults
    }
    
    // Map tier + billing period to correct price ID
    let priceKey = tier;
    if (billingPeriod === 'annual') {
      if (tier === 'ghost_pro') {
        priceKey = 'ghost_pro_annual';
      } else if (tier === 'vault_pro' || tier === 'swissvault_pro') {
        priceKey = 'vault_pro_annual';
      }
    }
    
    if (!TIER_PRICES[priceKey]) {
      throw new Error(`Unknown tier: ${tier}`);
    }

    const tierConfig = TIER_PRICES[priceKey];
    console.log(`[create-pro-checkout] Creating checkout for tier: ${tier}, billing: ${billingPeriod}, priceKey: ${priceKey}`);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Determine success/cancel URLs based on tier and domain
    const baseUrl = getAppBaseUrl(req);
    const isGhostTier = tier.startsWith('ghost') || tier === 'swissvault_pro' || tier === 'vault_pro';
    const successUrl = isGhostTier
      ? `${baseUrl}/ghost?subscription=success`
      : `${baseUrl}/dashboard?subscription=success`;
    
    const cancelUrl = isGhostTier
      ? `${baseUrl}/ghost/upgrade?subscription=cancelled`
      : `${baseUrl}/#pricing`;

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
