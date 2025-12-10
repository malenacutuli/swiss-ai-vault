import { Button } from "@/components/ui/button";
import { Check, ArrowRight } from "lucide-react";
import { useState } from "react";
import { EarlyAccessModal } from "@/components/EarlyAccessModal";
import { DemoRequestModal } from "@/components/DemoRequestModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export const PricingSection = () => {
  const { t } = useTranslation();
  const [earlyAccessOpen, setEarlyAccessOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const plans = [
    {
      nameKey: "landing.pricing.plans.free.name",
      price: "$0",
      periodKey: "landing.pricing.plans.free.period",
      descriptionKey: "landing.pricing.plans.free.description",
      features: [
        t('landing.pricing.plans.free.feature1'),
        t('landing.pricing.plans.free.feature2'),
        t('landing.pricing.plans.free.feature3'),
        t('landing.pricing.plans.free.feature4'),
      ],
      ctaKey: "landing.pricing.plans.free.cta",
      variant: "outline" as const,
      popular: false,
      planId: "Free",
    },
    {
      nameKey: "landing.pricing.plans.pro.name",
      price: "$49",
      periodKey: "landing.pricing.plans.pro.period",
      descriptionKey: "landing.pricing.plans.pro.description",
      badgeKey: "landing.pricing.plans.pro.badge",
      features: [
        t('landing.pricing.plans.pro.feature1'),
        t('landing.pricing.plans.pro.feature2'),
        t('landing.pricing.plans.pro.feature3'),
        t('landing.pricing.plans.pro.feature4'),
        t('landing.pricing.plans.pro.feature5'),
      ],
      ctaKey: "landing.pricing.plans.pro.cta",
      variant: "swiss" as const,
      popular: true,
      planId: "Pro",
    },
    {
      nameKey: "landing.pricing.plans.enterprise.name",
      price: t('landing.pricing.plans.enterprise.price'),
      periodKey: "",
      descriptionKey: "landing.pricing.plans.enterprise.description",
      features: [
        t('landing.pricing.plans.enterprise.feature1'),
        t('landing.pricing.plans.enterprise.feature2'),
        t('landing.pricing.plans.enterprise.feature3'),
        t('landing.pricing.plans.enterprise.feature4'),
        t('landing.pricing.plans.enterprise.feature5'),
        t('landing.pricing.plans.enterprise.feature6'),
      ],
      ctaKey: "landing.pricing.plans.enterprise.cta",
      variant: "outline" as const,
      popular: false,
      planId: "Enterprise",
    },
  ];

  const handleCTA = async (planId: string) => {
    if (planId === "Enterprise") {
      setDemoOpen(true);
    } else if (planId === "Pro") {
      setIsLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
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
              {t('landing.pricing.title')}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('landing.pricing.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.planId}
                className={`relative rounded-2xl p-6 ${
                  plan.popular
                    ? "bg-card border-2 border-primary shadow-glow"
                    : "bg-card/50 border border-border/50"
                } backdrop-blur-sm`}
              >
                {plan.popular && plan.badgeKey && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium whitespace-nowrap">
                      {t(plan.badgeKey)}
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-semibold mb-2">{t(plan.nameKey)}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.periodKey ? t(plan.periodKey) : ''}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{t(plan.descriptionKey)}</p>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button 
                  variant={plan.variant} 
                  className="w-full"
                  onClick={() => handleCTA(plan.planId)}
                  disabled={plan.planId === "Pro" && isLoading}
                >
                  {plan.planId === "Pro" && isLoading ? t('common.loading') : t(plan.ctaKey)}
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
              {t('landing.pricing.sovereignNote')}
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
