import { useState, useEffect } from 'react';
import { Check, Sparkles, Building2, Users, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface SubscriptionTier {
  id: string;
  name: string;
  slug: string;
  price_cents: number;
  billing_period: 'monthly' | 'yearly' | null;
  features: string[];
  limits: {
    text_tokens_per_month?: number;
    images_per_month?: number;
    videos_per_month?: number;
    deep_research?: boolean;
    priority_support?: boolean;
    api_access?: boolean;
    team_members?: number;
  };
  is_popular?: boolean;
}

interface BillingStatus {
  tier_id: string;
  tier_name: string;
  subscription_status: string;
}

const TIER_ICONS: Record<string, React.ReactNode> = {
  free: <Sparkles className="w-6 h-6" />,
  pro: <Crown className="w-6 h-6" />,
  team: <Users className="w-6 h-6" />,
  enterprise: <Building2 className="w-6 h-6" />,
};

// Default tiers - will be replaced by database query when available
const DEFAULT_TIERS: SubscriptionTier[] = [
  {
    id: 'free',
    name: 'Free',
    slug: 'free',
    price_cents: 0,
    billing_period: 'monthly',
    features: [
      '50K tokens per month',
      '10 images per day',
      '3 videos per day',
      'Basic models access',
      'Community support',
    ],
    limits: {
      text_tokens_per_month: 50000,
      images_per_month: 300,
      videos_per_month: 90,
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    slug: 'pro',
    price_cents: 1900,
    billing_period: 'monthly',
    features: [
      '500K tokens per month',
      '100 images per day',
      '20 videos per day',
      'All models access',
      'Deep Research',
      'Priority support',
      'API access',
    ],
    limits: {
      text_tokens_per_month: 500000,
      images_per_month: 3000,
      videos_per_month: 600,
      deep_research: true,
      priority_support: true,
      api_access: true,
    },
    is_popular: true,
  },
  {
    id: 'team',
    name: 'Team',
    slug: 'team',
    price_cents: 20000,
    billing_period: 'monthly',
    features: [
      '5M tokens per month',
      'Unlimited images',
      'Unlimited videos',
      'All models access',
      'Deep Research',
      'Priority support',
      'API access',
      'Up to 10 team members',
      'Admin dashboard',
    ],
    limits: {
      text_tokens_per_month: 5000000,
      images_per_month: -1,
      videos_per_month: -1,
      deep_research: true,
      priority_support: true,
      api_access: true,
      team_members: 10,
    },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    slug: 'enterprise',
    price_cents: -1, // Custom pricing
    billing_period: null,
    features: [
      'Unlimited tokens',
      'Unlimited images',
      'Unlimited videos',
      'All models access',
      'Deep Research',
      'Dedicated support',
      'Custom API limits',
      'Unlimited team members',
      'SSO & SAML',
      'Custom contracts',
      'SLA guarantee',
    ],
    limits: {
      text_tokens_per_month: -1,
      images_per_month: -1,
      videos_per_month: -1,
      deep_research: true,
      priority_support: true,
      api_access: true,
      team_members: -1,
    },
  },
];

interface TierSelectionProps {
  onSelectTier?: (tierId: string) => void;
  className?: string;
}

export function TierSelection({ onSelectTier, className }: TierSelectionProps) {
  const { user } = useAuth();
  const [tiers, setTiers] = useState<SubscriptionTier[]>(DEFAULT_TIERS);
  const [currentTier, setCurrentTier] = useState<string>('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // TODO: When subscription_tiers table exists, fetch from database
        // For now, use default tiers
        // const { data: tiersData } = await supabase
        //   .from('subscription_tiers')
        //   .select('*')
        //   .order('price_cents', { ascending: true });

        // TODO: When get_billing_status RPC exists, fetch user's current tier
        // if (user) {
        //   const { data: statusData } = await supabase.rpc('get_billing_status', {
        //     p_user_id: user.id,
        //   });
        //   if (statusData) {
        //     setCurrentTier(statusData.tier_id || 'free');
        //   }
        // }

        // Use default tiers until migration is run
        setTiers(DEFAULT_TIERS);
        setCurrentTier('free');
      } catch (error) {
        console.log('Using default tiers');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const formatPrice = (priceCents: number, period: string | null) => {
    if (priceCents === -1) return 'Custom';
    if (priceCents === 0) return 'Free';
    const price = priceCents / 100;
    return `$${price}${period ? '/mo' : ''}`;
  };

  const handleSelectTier = (tierId: string) => {
    if (tierId === currentTier) return;
    onSelectTier?.(tierId);
  };

  const getButtonText = (tier: SubscriptionTier) => {
    if (tier.id === currentTier) return 'Current Plan';
    if (tier.price_cents === -1) return 'Contact Sales';
    if (tier.price_cents === 0 && currentTier !== 'free') return 'Downgrade';
    return 'Upgrade';
  };

  const getButtonVariant = (tier: SubscriptionTier): 'default' | 'outline' | 'secondary' => {
    if (tier.id === currentTier) return 'secondary';
    if (tier.price_cents === -1) return 'outline';
    return 'default';
  };

  if (loading) {
    return (
      <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6', className)}>
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-[480px] rounded-lg bg-card animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6', className)}>
      {tiers.map((tier, index) => {
        const isCurrentTier = tier.id === currentTier;
        const isPopular = tier.is_popular;

        return (
          <div
            key={tier.id}
            className={cn(
              'relative flex flex-col rounded-lg p-6 transition-all duration-300',
              'bg-[#FDFBF7] dark:bg-card',
              'border-2',
              isCurrentTier
                ? 'border-[#1A365D] dark:border-primary shadow-swiss-elevated'
                : 'border-[#E5E0D5] dark:border-border hover:shadow-swiss-card',
              'hover:-translate-y-1'
            )}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            {/* Badges */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex gap-2">
              {isCurrentTier && (
                <span className="px-3 py-1 text-xs font-medium tracking-caps bg-[#1A365D] text-white rounded-full whitespace-nowrap">
                  Current Plan
                </span>
              )}
              {isPopular && !isCurrentTier && (
                <span className="px-3 py-1 text-xs font-medium tracking-caps bg-[#722F37] text-white rounded-full whitespace-nowrap">
                  Most Popular
                </span>
              )}
            </div>

            {/* Icon & Title */}
            <div className="flex items-center gap-3 mt-4 mb-4">
              <div className="p-2 rounded-lg bg-[#1A365D]/10 dark:bg-primary/20 text-[#1A365D] dark:text-primary">
                {TIER_ICONS[tier.slug] || <Sparkles className="w-6 h-6" />}
              </div>
              <h3 className="font-serif text-xl font-semibold tracking-luxury uppercase text-foreground">
                {tier.name}
              </h3>
            </div>

            {/* Price */}
            <div className="mb-6">
              <div className="flex items-baseline gap-1">
                <span className="font-serif text-4xl font-bold text-foreground">
                  {formatPrice(tier.price_cents, tier.billing_period)}
                </span>
                {tier.billing_period && tier.price_cents > 0 && (
                  <span className="text-sm text-muted-foreground">
                    / month
                  </span>
                )}
              </div>
              {tier.billing_period === 'monthly' && tier.price_cents > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Billed monthly
                </p>
              )}
            </div>

            {/* Features */}
            <ul className="flex-1 space-y-3 mb-6">
              {tier.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 mt-0.5 text-success shrink-0" />
                  <span className="text-foreground/80">{feature}</span>
                </li>
              ))}
            </ul>

            {/* CTA Button */}
            <Button
              variant={getButtonVariant(tier)}
              className={cn(
                'w-full h-11 font-medium tracking-wide',
                tier.id === currentTier && 'cursor-default',
                tier.id !== currentTier && tier.price_cents !== -1 && 
                  'bg-[#1A365D] hover:bg-[#1A365D]/90 text-white dark:bg-primary dark:hover:bg-primary/90'
              )}
              onClick={() => handleSelectTier(tier.id)}
              disabled={tier.id === currentTier}
            >
              {getButtonText(tier)}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

export default TierSelection;
