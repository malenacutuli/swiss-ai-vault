import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    // Get the raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      logStep("ERROR: Missing stripe-signature header");
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!stripeSecretKey || !webhookSecret) {
      logStep("ERROR: Missing Stripe configuration");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

    // Verify the webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      logStep("Signature verified", { eventType: event.type, eventId: event.id });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      logStep("ERROR: Signature verification failed", { error: errorMessage });
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle checkout.session.completed event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      logStep("Processing checkout.session.completed", { 
        sessionId: session.id,
        metadata: session.metadata 
      });

      // Extract user_id and credits from metadata
      const userId = session.metadata?.user_id;
      const creditsStr = session.metadata?.credits;
      const amountPaid = session.amount_total ? session.amount_total / 100 : 0;

      if (!userId || !creditsStr) {
        logStep("ERROR: Missing metadata", { userId, creditsStr });
        // Return 200 to acknowledge receipt (don't want Stripe to retry)
        return new Response(JSON.stringify({ received: true, warning: "Missing metadata" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const credits = parseFloat(creditsStr);
      logStep("Extracted payment details", { userId, credits, amountPaid });

      // Initialize Supabase with service role key
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("EXTERNAL_SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Update user_credits - add credits to balance
      const { data: existingCredits, error: fetchError } = await supabase
        .from("user_credits")
        .select("balance")
        .eq("user_id", userId)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        logStep("ERROR: Failed to fetch user credits", { error: fetchError.message });
      }

      if (existingCredits) {
        // Update existing record
        const newBalance = parseFloat(existingCredits.balance.toString()) + credits;
        const { error: updateError } = await supabase
          .from("user_credits")
          .update({ balance: newBalance, updated_at: new Date().toISOString() })
          .eq("user_id", userId);

        if (updateError) {
          logStep("ERROR: Failed to update credits", { error: updateError.message });
        } else {
          logStep("Credits updated successfully", { newBalance });
        }
      } else {
        // Insert new record if doesn't exist
        const { error: insertError } = await supabase
          .from("user_credits")
          .insert({ user_id: userId, balance: credits });

        if (insertError) {
          logStep("ERROR: Failed to insert credits", { error: insertError.message });
        } else {
          logStep("Credits inserted successfully", { balance: credits });
        }
      }

      // Insert credit_transactions record (negative credits_used means credits added)
      const { error: transactionError } = await supabase
        .from("credit_transactions")
        .insert({
          user_id: userId,
          service_type: "CREDIT_PURCHASE",
          credits_used: -credits, // Negative value for credits added
          description: "Credit purchase via Stripe",
          metadata: {
            checkout_session_id: session.id,
            amount_paid: amountPaid,
            currency: session.currency,
            payment_status: session.payment_status,
          },
        });

      if (transactionError) {
        logStep("ERROR: Failed to insert transaction", { error: transactionError.message });
      } else {
        logStep("Transaction recorded successfully");
      }

      // Create notification for the user
      const { error: notificationError } = await supabase
        .from("notifications")
        .insert({
          user_id: userId,
          type: "success",
          title: "Credits Added",
          message: `Successfully added $${credits.toFixed(2)} in credits to your account`,
          metadata: {
            link: "/dashboard/billing",
            checkout_session_id: session.id,
            credits_added: credits,
          },
        });

      if (notificationError) {
        logStep("ERROR: Failed to create notification", { error: notificationError.message });
      } else {
        logStep("Notification created successfully");
      }

      logStep("Checkout session processed successfully", { userId, credits });
    } else {
      logStep("Unhandled event type", { type: event.type });
    }

    // Return 200 OK to acknowledge receipt
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("ERROR: Unhandled exception", { error: errorMessage });
    
    // Return 200 to prevent Stripe retries for unhandled errors
    // Log the error but don't expose internal details
    return new Response(JSON.stringify({ received: true, error: "Internal processing error" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
