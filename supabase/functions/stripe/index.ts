// supabase/functions/stripe/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import Stripe from "https://esm.sh/stripe@14.10.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const APP_URL = Deno.env.get("APP_URL") || "https://swissbrain.ai";

// Price IDs for different tiers
const PRICE_IDS = {
  pro_monthly: Deno.env.get("STRIPE_PRO_MONTHLY_PRICE_ID"),
  pro_yearly: Deno.env.get("STRIPE_PRO_YEARLY_PRICE_ID"),
  enterprise_monthly: Deno.env.get("STRIPE_ENTERPRISE_MONTHLY_PRICE_ID"),
  enterprise_yearly: Deno.env.get("STRIPE_ENTERPRISE_YEARLY_PRICE_ID"),
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'webhook';

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    switch (action) {
      case 'webhook': {
        // Handle Stripe webhooks
        const signature = req.headers.get("stripe-signature");
        if (!signature) {
          throw new Error("Missing stripe-signature header");
        }

        const body = await req.text();
        const event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);

        console.log(`Received webhook: ${event.type}`);

        switch (event.type) {
          case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session;

            if (session.mode === 'subscription') {
              const subscriptionId = session.subscription as string;
              const customerId = session.customer as string;

              // Get subscription details
              const subscription = await stripe.subscriptions.retrieve(subscriptionId);
              const priceId = subscription.items.data[0].price.id;

              // Determine tier from price ID
              let tier = 'pro';
              if (priceId === PRICE_IDS.enterprise_monthly || priceId === PRICE_IDS.enterprise_yearly) {
                tier = 'enterprise';
              }

              // Get user ID from metadata
              const userId = session.metadata?.user_id;
              if (!userId) {
                throw new Error("No user_id in session metadata");
              }

              // Create or update stripe customer
              await serviceClient
                .from('stripe_customers')
                .upsert({
                  user_id: userId,
                  stripe_customer_id: customerId,
                  email: session.customer_email,
                  updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });

              // Create subscription record
              await serviceClient
                .from('subscriptions')
                .insert({
                  user_id: userId,
                  stripe_subscription_id: subscriptionId,
                  stripe_customer_id: customerId,
                  status: subscription.status,
                  tier,
                  price_id: priceId,
                  current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                  current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                  cancel_at_period_end: subscription.cancel_at_period_end
                });
            }
            break;
          }

          case 'customer.subscription.updated': {
            const subscription = event.data.object as Stripe.Subscription;

            await serviceClient
              .from('subscriptions')
              .update({
                status: subscription.status,
                current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                cancel_at_period_end: subscription.cancel_at_period_end,
                updated_at: new Date().toISOString()
              })
              .eq('stripe_subscription_id', subscription.id);
            break;
          }

          case 'customer.subscription.deleted': {
            const subscription = event.data.object as Stripe.Subscription;

            await serviceClient
              .from('subscriptions')
              .update({
                status: 'canceled',
                updated_at: new Date().toISOString()
              })
              .eq('stripe_subscription_id', subscription.id);
            break;
          }

          case 'invoice.paid': {
            const invoice = event.data.object as Stripe.Invoice;

            // Get user_id from stripe_customer
            const { data: customer } = await serviceClient
              .from('stripe_customers')
              .select('user_id')
              .eq('stripe_customer_id', invoice.customer as string)
              .single();

            if (customer) {
              // Get subscription UUID
              let subscriptionUuid = null;
              if (invoice.subscription) {
                const { data: sub } = await serviceClient
                  .from('subscriptions')
                  .select('id')
                  .eq('stripe_subscription_id', invoice.subscription as string)
                  .single();
                subscriptionUuid = sub?.id;
              }

              await serviceClient
                .from('invoices')
                .insert({
                  user_id: customer.user_id,
                  stripe_invoice_id: invoice.id,
                  stripe_customer_id: invoice.customer as string,
                  subscription_id: subscriptionUuid,
                  amount_paid: invoice.amount_paid,
                  amount_due: invoice.amount_due,
                  currency: invoice.currency,
                  status: invoice.status || 'paid',
                  invoice_pdf: invoice.invoice_pdf,
                  hosted_invoice_url: invoice.hosted_invoice_url
                });
            }
            break;
          }

          case 'invoice.payment_failed': {
            const invoice = event.data.object as Stripe.Invoice;

            // Get user_id from stripe_customer
            const { data: customer } = await serviceClient
              .from('stripe_customers')
              .select('user_id')
              .eq('stripe_customer_id', invoice.customer as string)
              .single();

            if (customer) {
              // Update subscription status to past_due
              if (invoice.subscription) {
                await serviceClient
                  .from('subscriptions')
                  .update({
                    status: 'past_due',
                    updated_at: new Date().toISOString()
                  })
                  .eq('stripe_subscription_id', invoice.subscription as string);
              }
            }
            break;
          }
        }

        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'create-checkout': {
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
        const { price_id, tier } = body;

        if (!price_id || !tier) {
          throw new Error('price_id and tier are required');
        }

        // Get or create Stripe customer
        let customerId: string;
        const { data: existingCustomer } = await serviceClient
          .from('stripe_customers')
          .select('stripe_customer_id')
          .eq('user_id', user.id)
          .single();

        if (existingCustomer) {
          customerId = existingCustomer.stripe_customer_id;
        } else {
          const customer = await stripe.customers.create({
            email: user.email,
            metadata: { user_id: user.id }
          });
          customerId = customer.id;

          await serviceClient
            .from('stripe_customers')
            .insert({
              user_id: user.id,
              stripe_customer_id: customerId,
              email: user.email
            });
        }

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          mode: 'subscription',
          payment_method_types: ['card'],
          line_items: [
            {
              price: price_id,
              quantity: 1
            }
          ],
          success_url: `${APP_URL}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${APP_URL}/billing?canceled=true`,
          metadata: {
            user_id: user.id,
            tier
          },
          subscription_data: {
            metadata: {
              user_id: user.id,
              tier
            }
          }
        });

        return new Response(JSON.stringify({ url: session.url }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'create-portal': {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Unauthorized');

        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Unauthorized');

        // Get Stripe customer ID
        const { data: customer } = await serviceClient
          .from('stripe_customers')
          .select('stripe_customer_id')
          .eq('user_id', user.id)
          .single();

        if (!customer) {
          throw new Error('No Stripe customer found');
        }

        // Create portal session
        const session = await stripe.billingPortal.sessions.create({
          customer: customer.stripe_customer_id,
          return_url: `${APP_URL}/billing`
        });

        return new Response(JSON.stringify({ url: session.url }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'subscription': {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Unauthorized');

        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Unauthorized');

        const { data, error } = await supabase.rpc('get_user_subscription', {
          p_user_id: user.id
        });

        if (error) throw error;

        return new Response(JSON.stringify({ subscription: data?.[0] || null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Stripe error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
