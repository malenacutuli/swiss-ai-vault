import { Button } from "@/components/ui/button";
import { Check, ArrowRight } from "lucide-react";
import { useState } from "react";
import { EarlyAccessModal } from "@/components/EarlyAccessModal";
import { DemoRequestModal } from "@/components/DemoRequestModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "For evaluation and small teams.",
    features: [
      "10K API calls / month",
      "2 fine-tuning jobs / month",
      "1GB dataset storage",
      "Community support",
    ],
    cta: "Get Started",
    variant: "outline" as const,
    popular: false,
  },
  {
    name: "Pro",
    price: "$49",
    period: "/month",
    description: "For teams building assistants and professionals looking for zero-trace AI needs.",
    badge: "Most popular for product teams",
    features: [
      "100K API calls / month",
      "20 fine-tuning jobs / month",
      "50GB dataset storage",
      "Advanced evaluation suite",
      "Webhook integrations, team workspaces",
    ],
    cta: "Get Started",
    variant: "swiss" as const,
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For banks, insurers, critical infrastructure.",
    features: [
      "1M+ API calls / month",
      "Unlimited fine-tuning jobs",
      "500GB+ storage",
      "Dedicated support & SLAs",
      "SSO & audit integrations",
      "Optional sovereign OSS-only tier",
    ],
    cta: "Contact Sales",
    variant: "outline" as const,
    popular: false,
  },
];

export const PricingSection = () => {
  const [earlyAccessOpen, setEarlyAccessOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleCTA = async (planName: string) => {
    if (planName === "Enterprise") {
      setDemoOpen(true);
    } else if (planName === "Pro") {
      setIsLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          // Store checkout intent in localStorage and redirect to auth
          localStorage.setItem('pendingCheckout', 'pro');
          navigate('/auth');
          setIsLoading(false);
          return;
        }
        const { data, error } = await supabase.functions.invoke('create-pro-checkout');
        if (error) throw error;
        if (data?.url) {
          window.open(data.url, '_blank');
        }
      } catch (error) {
        console.error("Checkout error:", error);
        toast.error("Failed to start checkout. Please try again.");
      } finally {
        setIsLoading(false);
      }
    } else {
      setEarlyAccessOpen(true);
    }
  };

  return (
    <>
      <section id="pricing" className="py-24 relative">
        <div className="absolute inset-0 gradient-swiss opacity-30" />
        
        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Start Free, Grow to Enterprise
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Simple plans for teams getting started, with custom options for regulated enterprises.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-6 ${
                  plan.popular
                    ? "bg-card border-2 border-primary shadow-glow"
                    : "bg-card/50 border border-border/50"
                } backdrop-blur-sm`}
              >
                {plan.popular && plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium whitespace-nowrap">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button 
                  variant={plan.variant} 
                  className="w-full"
                  onClick={() => handleCTA(plan.name)}
                  disabled={plan.name === "Pro" && isLoading}
                >
                  {plan.name === "Pro" && isLoading ? "Loading..." : plan.cta}
                </Button>
              </div>
            ))}
          </div>

          {/* Sovereign deployment note */}
          <div className="mt-12 text-center">
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); setDemoOpen(true); }}
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              Need on-premise or your own GPUs? Talk to us about sovereign deployment
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      <EarlyAccessModal open={earlyAccessOpen} onOpenChange={setEarlyAccessOpen} />
      <DemoRequestModal open={demoOpen} onOpenChange={setDemoOpen} />
    </>
  );
};
