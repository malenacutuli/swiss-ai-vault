import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for experimenting and small projects",
    features: [
      "10K API calls/month",
      "2 fine-tuning jobs/month",
      "1GB dataset storage",
      "Community support",
      "Basic evaluation metrics",
    ],
    cta: "Get Started",
    variant: "outline" as const,
    popular: false,
  },
  {
    name: "Pro",
    price: "$49",
    period: "/month",
    description: "For teams building production applications",
    features: [
      "100K API calls/month",
      "20 fine-tuning jobs/month",
      "50GB dataset storage",
      "Priority support",
      "Advanced evaluation suite",
      "Webhook integrations",
      "Team collaboration",
    ],
    cta: "Start Free Trial",
    variant: "swiss" as const,
    popular: true,
  },
  {
    name: "Enterprise",
    price: "$299",
    period: "/month",
    description: "For organizations with advanced requirements",
    features: [
      "1M+ API calls/month",
      "Unlimited fine-tuning jobs",
      "500GB+ dataset storage",
      "Dedicated support",
      "Custom model hosting",
      "SSO & audit logs",
      "SLA guarantee",
      "On-premise option",
    ],
    cta: "Contact Sales",
    variant: "outline" as const,
    popular: false,
  },
];

export const PricingSection = () => {
  return (
    <section id="pricing" className="py-24 relative">
      <div className="absolute inset-0 gradient-swiss opacity-30" />
      
      <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start free, scale as you grow. All plans include Swiss data residency
            and enterprise-grade security.
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
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                    Most Popular
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

              <Button variant={plan.variant} className="w-full">
                {plan.cta}
              </Button>
            </div>
          ))}
        </div>

        {/* Usage pricing note */}
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            Additional usage: <span className="text-foreground">$0.01/1K tokens</span> inference • 
            <span className="text-foreground"> $2.50/GPU hour</span> training • 
            <span className="text-foreground"> $0.10/GB/month</span> storage
          </p>
        </div>
      </div>
    </section>
  );
};
