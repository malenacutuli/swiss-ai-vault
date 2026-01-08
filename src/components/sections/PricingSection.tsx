import { Button } from "@/components/ui/button";
import { Check, ArrowRight } from "@/icons";
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
      nameKey: "home.pricing.ghostFree.name",
      price: "$0",
      periodKey: "home.pricing.ghostFree.period",
      descriptionKey: "home.pricing.ghostFree.description",
      features: [
        t('home.pricing.ghostFree.feature1'),
        t('home.pricing.ghostFree.feature2'),
        t('home.pricing.ghostFree.feature3'),
        t('home.pricing.ghostFree.feature4'),
        t('home.pricing.ghostFree.feature5'),
      ],
      ctaKey: "home.pricing.ghostFree.cta",
      variant: "outline" as const,
      popular: false,
      planId: "GhostFree",
    },
    {
      nameKey: "home.pricing.ghostPro.name",
      price: "$18",
      periodKey: "home.pricing.ghostPro.period",
      descriptionKey: "home.pricing.ghostPro.description",
      badgeKey: "home.pricing.ghostPro.badge",
      features: [
        t('home.pricing.ghostPro.feature1'),
        t('home.pricing.ghostPro.feature2'),
        t('home.pricing.ghostPro.feature3'),
        t('home.pricing.ghostPro.feature4'),
        t('home.pricing.ghostPro.feature5'),
      ],
      ctaKey: "home.pricing.ghostPro.cta",
      variant: "swiss" as const,
      popular: true,
      planId: "GhostPro",
      tier: "ghost_pro",
    },
    {
      nameKey: "home.pricing.vaultPro.name",
      price: "$49",
      periodKey: "home.pricing.vaultPro.period",
      descriptionKey: "home.pricing.vaultPro.description",
      features: [
        t('home.pricing.vaultPro.feature1'),
        t('home.pricing.vaultPro.feature2'),
        t('home.pricing.vaultPro.feature3'),
        t('home.pricing.vaultPro.feature4'),
        t('home.pricing.vaultPro.feature5'),
      ],
      ctaKey: "home.pricing.vaultPro.cta",
      variant: "swiss" as const,
      popular: false,
      planId: "VaultPro",
      tier: "vault_pro",
    },
    {
      nameKey: "home.pricing.pro.name",
      price: "$200",
      periodKey: "home.pricing.pro.period",
      descriptionKey: "home.pricing.pro.description",
      badgeKey: "home.pricing.pro.badge",
      features: [
        t('home.pricing.pro.feature1'),
        t('home.pricing.pro.feature2'),
        t('home.pricing.pro.feature3'),
        t('home.pricing.pro.feature4'),
        t('home.pricing.pro.feature5'),
      ],
      ctaKey: "home.pricing.pro.cta",
      variant: "outline" as const,
      popular: false,
      planId: "Pro",
    },
    {
      nameKey: "home.pricing.enterprise.name",
      price: t('home.pricing.enterprise.price'),
      periodKey: "",
      descriptionKey: "home.pricing.enterprise.description",
      features: [
        t('home.pricing.enterprise.feature1'),
        t('home.pricing.enterprise.feature2'),
        t('home.pricing.enterprise.feature3'),
        t('home.pricing.enterprise.feature4'),
        t('home.pricing.enterprise.feature5'),
        t('home.pricing.enterprise.feature6'),
      ],
      ctaKey: "home.pricing.enterprise.cta",
      variant: "outline" as const,
      popular: false,
      planId: "Enterprise",
    },
  ];

  const handleCTA = async (planId: string, tier?: string) => {
    if (planId === "Enterprise") {
      setDemoOpen(true);
    } else if (planId === "Pro") {
      setEarlyAccessOpen(true);
    } else if (planId === "GhostFree") {
      navigate('/ghost');
    } else if (planId === "GhostPro" || planId === "VaultPro") {
      setIsLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          localStorage.setItem('pendingCheckout', tier || 'ghost_pro');
          navigate('/auth');
          setIsLoading(false);
          return;
        }
        const { data, error } = await supabase.functions.invoke('create-pro-checkout', {
          body: { tier: tier || 'ghost_pro', billing_period: 'monthly' }
        });
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
            <h2 className="text-3xl sm:text-4xl font-normal tracking-[-0.045em] leading-[1.07] mb-4 text-foreground">
              {t('home.pricing.title')}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('home.pricing.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 max-w-7xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.planId}
                className={`relative rounded-2xl p-5 flex flex-col ${
                  plan.popular
                    ? "bg-card border-2 border-primary shadow-glow"
                    : "bg-card border border-border/60"
                }`}
              >
                {plan.popular && plan.badgeKey && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium whitespace-nowrap">
                      {t(plan.badgeKey)}
                    </span>
                  </div>
                )}
                {!plan.popular && plan.badgeKey && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium whitespace-nowrap">
                      {t(plan.badgeKey)}
                    </span>
                  </div>
                )}

                <div className="mb-4">
                  <h3 className="text-lg font-semibold mb-2">{t(plan.nameKey)}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">{plan.periodKey ? t(plan.periodKey) : ''}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{t(plan.descriptionKey)}</p>
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs">
                      <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button 
                  variant={plan.variant} 
                  size="sm"
                  className="w-full"
                  onClick={() => handleCTA(plan.planId, (plan as any).tier)}
                  disabled={(plan.planId === "GhostPro" || plan.planId === "VaultPro") && isLoading}
                >
                  {(plan.planId === "GhostPro" || plan.planId === "VaultPro") && isLoading 
                    ? t('common.loading') 
                    : t(plan.ctaKey)}
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
              {t('home.pricing.sovereignDeployment')}
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
