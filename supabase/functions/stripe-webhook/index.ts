import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

// Initialize Supabase early for DB logging
const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("EXTERNAL_SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") || "";

// Database logging helper - writes to webhook_logs table for debugging
const logToDb = async (functionName: string, message: string, data?: Record<string, unknown>, level: string = "info") => {
  try {
    if (!supabaseUrl || !supabaseKey) return;
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.from("webhook_logs").insert({
      function_name: functionName,
      message,
      data: data || {},
      level,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    // Silently fail - this is just for debugging
    console.error("[DB-LOG-FAIL]", e);
  }
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
  // Also log to database for debugging
  logToDb("stripe-webhook", step, details, details?.error ? "error" : "info");
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received", { method: req.method, url: req.url });

    // Get the raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      logStep("ERROR: Missing stripe-signature header", { error: "Missing signature" });
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!stripeSecretKey || !webhookSecret) {
      logStep("ERROR: Missing Stripe configuration", { 
        error: "Missing config",
        hasStripeKey: !!stripeSecretKey,
        hasWebhookSecret: !!webhookSecret 
      });
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-08-27.basil" });

    // Verify the webhook signature
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      logStep("Signature verified", { eventType: event.type, eventId: event.id });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      logStep("ERROR: Signature verification failed", { error: errorMessage, signaturePrefix: signature.substring(0, 20) });
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase with service role key
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Helper to get user_id from Stripe customer email
    const getUserIdFromCustomer = async (customerId: string): Promise<string | null> => {
      try {
        const customer = await stripe.customers.retrieve(customerId);
        if (customer.deleted) return null;
        
        const email = (customer as Stripe.Customer).email;
        if (!email) return null;

        const { data: user } = await supabase
          .from("users")
          .select("id")
          .eq("email", email)
          .single();

        return user?.id || null;
      } catch (error) {
        logStep("ERROR: Failed to get user from customer", { error: String(error) });
        return null;
      }
    };

    // Handle different event types
    switch (event.type) {
      // ============================================
      // CHECKOUT SESSION COMPLETED
      // ============================================
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Processing checkout.session.completed", { 
          sessionId: session.id,
          mode: session.mode,
          metadata: session.metadata 
        });

        const userId = session.metadata?.user_id;
        
        if (!userId) {
          logStep("WARNING: Missing user_id in metadata");
          break;
        }

        // ============================================
        // GHOST SUBSCRIPTION HANDLING
        // ============================================
        const productType = session.metadata?.product_type;
        const tier = session.metadata?.tier;

        if (productType === "ghost_subscription" && tier) {
          logStep("Processing Ghost subscription", { tier, subscriptionId: session.subscription });

          // Update ghost_subscriptions table
          const { error: ghostSubError } = await supabase
            .from("ghost_subscriptions")
            .upsert({
              user_id: userId,
              tier: tier,
              plan: tier,
              started_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            }, { onConflict: "user_id" });

          if (ghostSubError) {
            logStep("ERROR: Failed to update ghost_subscriptions", { error: ghostSubError.message });
          } else {
            logStep("Ghost subscription updated successfully", { tier });
          }

          // CRITICAL FIX: Update unified_subscriptions (the table that frontend reads via useSubscription hook)
          const { error: unifiedError } = await supabase
            .from("unified_subscriptions")
            .upsert({
              user_id: userId,
              tier: tier,
              status: "active",
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
              current_period_start: new Date().toISOString(),
              current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            }, { onConflict: "user_id" });

          if (unifiedError) {
            logStep("ERROR: Failed to update unified_subscriptions", { error: unifiedError.message });
          } else {
            logStep("Unified subscription updated successfully", { tier, userId });
          }

          // Also update billing_customers for consistency
          await supabase
            .from("billing_customers")
            .upsert({
              user_id: userId,
              email: session.customer_email || "",
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
              subscription_status: "active",
              tier: tier,
              current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            }, { onConflict: "user_id" });

          // Create welcome notification
          const tierName = tier === "ghost_pro" ? "Ghost Pro" : tier === "swissvault_pro" ? "SwissVault Pro" : tier;
          await supabase.from("notifications").insert({
            user_id: userId,
            type: "success",
            title: "Subscription Activated",
            message: `Welcome to ${tierName}! Your subscription is now active.`,
            metadata: { link: "/ghost/chat" },
          });

          break;
        }

        // SUBSCRIPTION SIGNUP (existing logic)
        if (session.mode === "subscription") {
          logStep("Processing subscription signup", { subscriptionId: session.subscription });
          
          // Get subscription details from Stripe
          const subscriptionId = session.subscription as string;
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items.data[0]?.price.id;

          // Find tier by price ID
          const { data: tier, error: tierError } = await supabase
            .from("subscription_tiers")
            .select("name")
            .eq("stripe_price_id", priceId)
            .single();

          if (tierError) {
            logStep("WARNING: Could not find tier for price", { priceId, error: tierError.message });
            // Fallback: update billing_customers directly
            await supabase
              .from("billing_customers")
              .upsert({
                user_id: userId,
                email: session.customer_email || "",
                stripe_customer_id: session.customer as string,
                stripe_subscription_id: subscriptionId,
                subscription_status: "active",
                tier: "pro", // Default to pro
                current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              }, { onConflict: "user_id" });
          } else {
            // Update user subscription via RPC if available, otherwise direct update
            const { error: updateError } = await supabase
              .from("billing_customers")
              .upsert({
                user_id: userId,
                email: session.customer_email || "",
                stripe_customer_id: session.customer as string,
                stripe_subscription_id: subscriptionId,
                subscription_status: "active",
                tier: tier.name,
                current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              }, { onConflict: "user_id" });

            if (updateError) {
              logStep("ERROR: Failed to update subscription", { error: updateError.message });
            } else {
              logStep("Subscription updated successfully", { tier: tier.name });
            }
          }

          // Create notification
          await supabase.from("notifications").insert({
            user_id: userId,
            type: "success",
            title: "Subscription Activated",
            message: `Welcome to SwissVault ${tier?.name || "Pro"}! Your subscription is now active.`,
            metadata: { link: "/dashboard/billing" },
          });
        }

        // ONE-TIME CREDIT PURCHASE
        if (session.mode === "payment") {
          const creditType = session.metadata?.type || "usage";
          const creditsStr = session.metadata?.credits;
          const credits = creditsStr ? parseFloat(creditsStr) : 0;
          const amountPaid = session.amount_total ? session.amount_total / 100 : 0;

          logStep("Processing credit purchase", { creditType, credits, amountPaid });

          if (creditType === "usage" && credits > 0) {
            // Add usage credits to user_credits table
            const { data: existingCredits } = await supabase
              .from("user_credits")
              .select("balance")
              .eq("user_id", userId)
              .single();

            if (existingCredits) {
              const newBalance = parseFloat(existingCredits.balance.toString()) + credits;
              await supabase
                .from("user_credits")
                .update({ balance: newBalance, updated_at: new Date().toISOString() })
                .eq("user_id", userId);
              logStep("Usage credits updated", { newBalance });
            } else {
              await supabase
                .from("user_credits")
                .insert({ user_id: userId, balance: credits });
              logStep("Usage credits inserted", { balance: credits });
            }

            // Record transaction
            await supabase.from("credit_transactions").insert({
              user_id: userId,
              service_type: "USAGE_CREDIT_PURCHASE",
              credits_used: -credits,
              description: `Purchased $${credits} usage credits`,
              metadata: {
                checkout_session_id: session.id,
                amount_paid: amountPaid,
                currency: session.currency,
              },
            });
          }

          if (creditType === "training" && credits > 0) {
            // Add training credits - stored in ghost_credits or separate table
            const { data: ghostCredits } = await supabase
              .from("ghost_credits")
              .select("paid_credits_balance")
              .eq("user_id", userId)
              .single();

            if (ghostCredits) {
              const newBalance = (ghostCredits.paid_credits_balance || 0) + (credits * 100); // Store in cents
              await supabase
                .from("ghost_credits")
                .update({ paid_credits_balance: newBalance, updated_at: new Date().toISOString() })
                .eq("user_id", userId);
              logStep("Training credits updated", { newBalance });
            }

            // Record transaction
            await supabase.from("credit_transactions").insert({
              user_id: userId,
              service_type: "TRAINING_CREDIT_PURCHASE",
              credits_used: -credits,
              description: `Purchased $${credits} training credits`,
              metadata: {
                checkout_session_id: session.id,
                amount_paid: amountPaid,
                currency: session.currency,
              },
            });
          }

          // Create notification
          await supabase.from("notifications").insert({
            user_id: userId,
            type: "success",
            title: "Credits Added",
            message: `Successfully added $${credits.toFixed(2)} in ${creditType} credits`,
            metadata: { link: "/dashboard/billing", credits_added: credits },
          });
        }
        break;
      }

      // ============================================
      // SUBSCRIPTION UPDATED (Plan Change)
      // ============================================
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Processing subscription update", { 
          subscriptionId: subscription.id,
          status: subscription.status,
          metadata: subscription.metadata
        });

        // Check for Ghost subscription via metadata
        const ghostTier = subscription.metadata?.tier;
        const metaUserId = subscription.metadata?.user_id;

        if (ghostTier && metaUserId) {
          logStep("Processing Ghost subscription update", { tier: ghostTier, userId: metaUserId });

          // Update ghost_subscriptions
          await supabase
            .from("ghost_subscriptions")
            .update({
              tier: ghostTier,
              plan: ghostTier,
              expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
            })
            .eq("user_id", metaUserId);

          // CRITICAL FIX: Update unified_subscriptions (the table that frontend reads)
          await supabase
            .from("unified_subscriptions")
            .update({
              tier: ghostTier,
              status: subscription.status === "active" ? "active" : subscription.status,
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            })
            .eq("user_id", metaUserId);

          // Also update billing_customers
          await supabase
            .from("billing_customers")
            .update({
              tier: ghostTier,
              subscription_status: subscription.status === "active" ? "active" : subscription.status,
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            })
            .eq("user_id", metaUserId);

          const tierName = ghostTier === "ghost_pro" ? "Ghost Pro" : ghostTier === "swissvault_pro" ? "SwissVault Pro" : ghostTier;
          await supabase.from("notifications").insert({
            user_id: metaUserId,
            type: "info",
            title: "Subscription Updated",
            message: `Your ${tierName} subscription has been updated.`,
            metadata: { link: "/ghost/chat" },
          });

          break;
        }

        // Standard subscription update (existing logic)
        const customerId = subscription.customer as string;
        const userId = await getUserIdFromCustomer(customerId);

        if (!userId) {
          logStep("WARNING: Could not find user for customer", { customerId });
          break;
        }

        const newPriceId = subscription.items.data[0]?.price.id;
        
        // Find new tier
        const { data: tier } = await supabase
          .from("subscription_tiers")
          .select("name")
          .eq("stripe_price_id", newPriceId)
          .single();

        // Update billing_customers
        const { error: updateError } = await supabase
          .from("billing_customers")
          .update({
            tier: tier?.name || "pro",
            subscription_status: subscription.status,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        if (updateError) {
          logStep("ERROR: Failed to update subscription", { error: updateError.message });
        } else {
          logStep("Subscription updated", { tier: tier?.name, status: subscription.status });
        }

        // Notify user of plan change
        if (tier) {
          await supabase.from("notifications").insert({
            user_id: userId,
            type: "info",
            title: "Plan Updated",
            message: `Your subscription has been updated to ${tier.name}`,
            metadata: { link: "/dashboard/billing" },
          });
        }
        break;
      }

      // ============================================
      // SUBSCRIPTION DELETED (Cancellation)
      // ============================================
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Processing subscription cancellation", { 
          subscriptionId: subscription.id,
          metadata: subscription.metadata
        });

        // Check for Ghost subscription via metadata
        const ghostUserId = subscription.metadata?.user_id;
        const ghostTier = subscription.metadata?.tier;

        if (ghostUserId && (ghostTier === "ghost_pro" || ghostTier === "swissvault_pro")) {
          logStep("Processing Ghost subscription cancellation", { userId: ghostUserId, tier: ghostTier });

          // Downgrade to ghost_free
          await supabase
            .from("ghost_subscriptions")
            .update({
              tier: "free",
              plan: "free",
            })
            .eq("user_id", ghostUserId);

          // CRITICAL FIX: Update unified_subscriptions (the table that frontend reads)
          await supabase
            .from("unified_subscriptions")
            .update({
              tier: "ghost_free",
              status: "canceled",
              stripe_subscription_id: null,
            })
            .eq("user_id", ghostUserId);

          // Update billing_customers
          await supabase
            .from("billing_customers")
            .update({
              tier: "ghost_free",
              stripe_subscription_id: null,
              subscription_status: "canceled",
            })
            .eq("user_id", ghostUserId);

          await supabase.from("notifications").insert({
            user_id: ghostUserId,
            type: "info",
            title: "Subscription Canceled",
            message: "Your subscription has been canceled. You've been moved to Ghost Free.",
            metadata: { link: "/ghost/chat" },
          });

          break;
        }

        // Standard subscription cancellation (existing logic)
        const { error: updateError } = await supabase
          .from("billing_customers")
          .update({
            tier: "free",
            stripe_subscription_id: null,
            subscription_status: "canceled",
          })
          .eq("stripe_subscription_id", subscription.id);

        if (updateError) {
          logStep("ERROR: Failed to cancel subscription", { error: updateError.message });
        } else {
          logStep("Subscription canceled, downgraded to free");
        }

        // Get user_id to send notification
        const customerId = subscription.customer as string;
        const userId = await getUserIdFromCustomer(customerId);
        
        if (userId) {
          await supabase.from("notifications").insert({
            user_id: userId,
            type: "info",
            title: "Subscription Canceled",
            message: "Your subscription has been canceled. You've been moved to the free plan.",
            metadata: { link: "/dashboard/billing" },
          });
        }
        break;
      }

      // ============================================
      // INVOICE PAID (Monthly Renewal)
      // ============================================
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Processing invoice paid", { 
          invoiceId: invoice.id,
          subscriptionId: invoice.subscription 
        });

        if (invoice.subscription) {
          const subscriptionId = invoice.subscription as string;
          
          // Get subscription to update period end
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          
          // Update billing_customers with new period end
          await supabase
            .from("billing_customers")
            .update({
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              subscription_status: "active",
            })
            .eq("stripe_subscription_id", subscriptionId);

          // Check if Team tier - add monthly training credits
          const { data: billingCustomer } = await supabase
            .from("billing_customers")
            .select("user_id, tier")
            .eq("stripe_subscription_id", subscriptionId)
            .single();

          if (billingCustomer?.tier === "team" && billingCustomer.user_id) {
            // Add $50 training credits for Team tier
            const { data: ghostCredits } = await supabase
              .from("ghost_credits")
              .select("paid_credits_balance")
              .eq("user_id", billingCustomer.user_id)
              .single();

            if (ghostCredits) {
              const newBalance = (ghostCredits.paid_credits_balance || 0) + 5000; // $50 in cents
              await supabase
                .from("ghost_credits")
                .update({ paid_credits_balance: newBalance, updated_at: new Date().toISOString() })
                .eq("user_id", billingCustomer.user_id);
              
              logStep("Added monthly training credits for Team tier", { userId: billingCustomer.user_id, added: 5000 });
            }

            // Record transaction
            await supabase.from("credit_transactions").insert({
              user_id: billingCustomer.user_id,
              service_type: "TRAINING_CREDIT_ALLOCATION",
              credits_used: -50, // $50 added
              description: "Monthly subscription training credit allocation",
              metadata: { invoice_id: invoice.id },
            });
          }

          logStep("Invoice processed, subscription renewed", { subscriptionId });
        }
        break;
      }

      // ============================================
      // INVOICE PAYMENT FAILED
      // ============================================
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Processing invoice payment failed", { invoiceId: invoice.id });

        if (invoice.subscription) {
          // Update subscription status
          await supabase
            .from("billing_customers")
            .update({ subscription_status: "past_due" })
            .eq("stripe_subscription_id", invoice.subscription);

          // Notify user
          const customerId = invoice.customer as string;
          const userId = await getUserIdFromCustomer(customerId);
          
          if (userId) {
            await supabase.from("notifications").insert({
              user_id: userId,
              type: "error",
              title: "Payment Failed",
              message: "Your subscription payment failed. Please update your payment method.",
              metadata: { link: "/dashboard/billing" },
            });
          }
        }
        break;
      }

      default:
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
    return new Response(JSON.stringify({ received: true, error: "Internal processing error" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
