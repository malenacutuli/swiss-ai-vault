import { Button } from '@/components/ui/button';
import { FeatureList } from './FeatureList';
import { cn } from '@/lib/utils';

interface PricingCardProps {
  name: string;
  tagline: string;
  monthlyPrice: number;
  annualPrice: number;
  billingPeriod: 'monthly' | 'annual';
  features: string[];
  isPopular?: boolean;
  ctaText: string;
  ctaDisabled?: boolean;
  onCtaClick: () => void;
  isFree?: boolean;
  perSeat?: boolean;
}

export function PricingCard({
  name,
  tagline,
  monthlyPrice,
  annualPrice,
  billingPeriod,
  features,
  isPopular = false,
  ctaText,
  ctaDisabled = false,
  onCtaClick,
  isFree = false,
  perSeat = false,
}: PricingCardProps) {
  const isAnnual = billingPeriod === 'annual';
  const displayPrice = isAnnual ? annualPrice : monthlyPrice;
  const showStrikethrough = isAnnual && !isFree && monthlyPrice > annualPrice;

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-2xl border bg-card p-6 transition-shadow',
        isPopular
          ? 'border-primary/50 shadow-lg shadow-primary/5'
          : 'border-border/60'
      )}
    >
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
            Popular
          </span>
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-xl font-semibold text-foreground">{name}</h3>
        <p className="text-sm text-muted-foreground mt-1">{tagline}</p>
      </div>

      <div className="mb-6">
        {isFree ? (
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold text-foreground">Free</span>
          </div>
        ) : (
          <div className="flex items-baseline gap-2">
            {showStrikethrough && (
              <span className="text-lg text-muted-foreground line-through">
                ${monthlyPrice}
              </span>
            )}
            <span className="text-4xl font-bold text-foreground">
              ${displayPrice}
            </span>
            <span className="text-muted-foreground">
              /mo{perSeat && '/seat'}
            </span>
          </div>
        )}
        {isAnnual && !isFree && (
          <p className="text-xs text-muted-foreground mt-1">
            when billed annually
          </p>
        )}
      </div>

      <Button
        variant={isPopular ? 'default' : 'outline'}
        className="w-full mb-6"
        onClick={onCtaClick}
        disabled={ctaDisabled}
      >
        {ctaText}
      </Button>

      <FeatureList features={features} className="flex-1" />
    </div>
  );
}
