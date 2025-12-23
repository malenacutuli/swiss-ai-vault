import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Ghost credit packages - tokens mapped to price in cents
const CREDIT_PACKAGES = {
  "10000": { price: 500, name: "10K Ghost Tokens" },      // $5 for 10K tokens
  "50000": { price: 2000, name: "50K Ghost Tokens" },     // $20 for 50K tokens  
  "200000": { price: 6000, name: "200K Ghost Tokens" },   // $60 for 200K tokens
  "1000000": { price: 20000, name: "1M Ghost Tokens" },   // $200 for 1M tokens
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
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user?.email) throw new Error("User not authenticated");

    // Get requested credit amount
    const { credits } = await req.json();
    const creditAmount = String(credits) as keyof typeof CREDIT_PACKAGES;
    
    if (!(creditAmount in CREDIT_PACKAGES)) {
      return new Response(
        JSON.stringify({ error: "Invalid credit package", available: Object.keys(CREDIT_PACKAGES) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const pkg = CREDIT_PACKAGES[creditAmount];

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Check for existing Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Create checkout session for one-time payment
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: pkg.name,
              description: `${parseInt(creditAmount).toLocaleString()} tokens for Ghost Mode AI inference`,
            },
            unit_amount: pkg.price,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/ghost?purchase=success&credits=${creditAmount}`,
      cancel_url: `${req.headers.get("origin")}/ghost?purchase=cancelled`,
      metadata: {
        user_id: user.id,
        credits: creditAmount,
        type: "ghost_credits",
      },
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[create-ghost-credits-checkout] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
