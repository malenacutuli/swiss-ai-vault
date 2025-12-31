import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Ghost, ArrowLeft } from '@/icons';
import { Button } from '@/components/ui/button';
import {
  PricingTabs,
  BillingToggle,
  PricingCard,
  TrustBadges,
} from '@/components/pricing';

const PERSONAL_TIERS = [
  {
    name: 'Ghost Free',
    tagline: 'Privacy-first AI for everyone',
    monthlyPrice: 0,
    annualPrice: 0,
    isFree: true,
    ctaText: 'Get Started',
    features: [
      '10 daily text prompts',
      '2 daily image generations',
      '2 daily video generations',
      'Swiss AI models',
      'Zero server data retention',
      'Browser-only encrypted storage',
      '5 Discovery modules (Finance, Legal, Patents, Research, Security)',
      'No account required',
    ],
  },
  {
    name: 'Ghost Pro',
    tagline: 'For power users who need more',
    monthlyPrice: 20,
    annualPrice: 17,
    isPopular: true,
    ctaText: 'Get Ghost Pro',
    tier: 'ghost_pro',
    features: [
      'Unlimited text prompts',
      '100 daily image generations',
      '20 daily video generations',
      'GPT-4o, Claude 3.5, Gemini 2.0',
      'All 10 Discovery modules (incl. Health, Travel, Real Estate, Art, VC)',
      'Deep Research (10/month)',
      '32K context window',
      'Cloud sync across devices',
      'API access (10K requests/month)',
    ],
  },
  {
    name: 'Vault Pro',
    tagline: 'Enterprise-grade privacy & integrations',
    monthlyPrice: 60,
    annualPrice: 49,
    ctaText: 'Get Vault Pro',
    tier: 'vault_pro',
    features: [
      'Everything in Ghost Pro',
      'Vault Chat with end-to-end encryption',
      '5 integrations (Slack, GitHub, Gmail, Drive, Notion)',
      '50 documents per month',
      '25 Deep Research per month',
      'Team folders & sharing',
      'Export & backup',
      'Voice features (coming soon)',
      'Priority support',
    ],
  },
];

const BUSINESS_TIERS = [
  {
    name: 'Team',
    tagline: 'For teams getting started',
    monthlyPrice: 40,
    annualPrice: 33,
    ctaText: 'Contact Sales',
    perSeat: true,
    tier: 'team',
    features: [
      'Everything in Vault Pro',
      'Centralized team billing',
      'User management & roles',
      'Shared folders & workspaces',
      'Team analytics dashboard',
      'Slack/Teams notifications',
      'SSO coming soon',
      'Dedicated onboarding',
    ],
  },
  {
    name: 'Team Plus',
    tagline: 'For security-focused organizations',
    monthlyPrice: 80,
    annualPrice: 67,
    isPopular: true,
    ctaText: 'Contact Sales',
    perSeat: true,
    tier: 'team_plus',
    features: [
      'Everything in Team',
      'SSO/SAML authentication',
      'Advanced audit logs',
      'Custom data retention policies',
      'Dedicated account manager',
      'Custom integrations',
      'On-premise deployment option',
      '99.9% SLA guarantee',
      'Enterprise security review',
    ],
  },
];

export default function GhostPricing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'personal' | 'business'>('personal');
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('annual');
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const tiers = activeTab === 'personal' ? PERSONAL_TIERS : BUSINESS_TIERS;

  const handleCtaClick = async (tier: typeof PERSONAL_TIERS[0]) => {
    // Free tier - just go to Ghost
    if (tier.isFree) {
      navigate('/ghost');
      return;
    }

    // Contact sales for business tiers
    if (tier.ctaText === 'Contact Sales') {
      navigate('/contact');
      return;
    }

    // Not logged in - redirect to auth
    if (!user) {
      navigate(`/auth?intent=ghost&plan=${tier.tier}`);
      return;
    }

    // Proceed to checkout
    setIsLoading(tier.tier || null);
    try {
      const { data, error } = await supabase.functions.invoke('create-pro-checkout', {
        body: {
          tier: tier.tier,
          billing_period: billingPeriod,
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error('Failed to start checkout. Please try again.');
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9f6]">
      {/* Header */}
      <header className="border-b border-border/40 bg-[#faf9f6]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/ghost')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Ghost className="h-6 w-6 text-primary" />
            <span className="font-semibold">SwissVault.ai</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-serif font-medium text-foreground mb-4">
            Choose your plan
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Privacy-first AI with Swiss data residency. No data retention, no compromises.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-8">
          <PricingTabs activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        {/* Billing Toggle */}
        <div className="mb-12">
          <BillingToggle
            billingPeriod={billingPeriod}
            onBillingChange={setBillingPeriod}
            savingsPercent={17}
          />
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto mb-16">
          {tiers.map((tier) => (
            <PricingCard
              key={tier.name}
              name={tier.name}
              tagline={tier.tagline}
              monthlyPrice={tier.monthlyPrice}
              annualPrice={tier.annualPrice}
              billingPeriod={billingPeriod}
              features={tier.features}
              isPopular={tier.isPopular}
              ctaText={isLoading === tier.tier ? 'Loading...' : tier.ctaText}
              ctaDisabled={isLoading !== null}
              onCtaClick={() => handleCtaClick(tier)}
              isFree={tier.isFree}
              perSeat={'perSeat' in tier ? tier.perSeat : false}
            />
          ))}
        </div>

        {/* Trust Badges */}
        <div className="border-t border-border/40 pt-12">
          <TrustBadges />
        </div>
      </main>
    </div>
  );
}
