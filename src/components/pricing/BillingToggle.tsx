import { cn } from '@/lib/utils';

interface BillingToggleProps {
  billingPeriod: 'monthly' | 'annual';
  onBillingChange: (period: 'monthly' | 'annual') => void;
  savingsPercent?: number;
}

export function BillingToggle({ 
  billingPeriod, 
  onBillingChange, 
  savingsPercent = 17 
}: BillingToggleProps) {
  return (
    <div className="flex items-center justify-center gap-4">
      <span
        className={cn(
          'text-sm font-medium transition-colors cursor-pointer',
          billingPeriod === 'monthly' ? 'text-foreground' : 'text-muted-foreground'
        )}
        onClick={() => onBillingChange('monthly')}
      >
        Monthly
      </span>
      
      <button
        onClick={() => onBillingChange(billingPeriod === 'monthly' ? 'annual' : 'monthly')}
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
          billingPeriod === 'annual' ? 'bg-primary' : 'bg-muted'
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-background shadow-sm transition-transform',
            billingPeriod === 'annual' ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
      
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'text-sm font-medium transition-colors cursor-pointer',
            billingPeriod === 'annual' ? 'text-foreground' : 'text-muted-foreground'
          )}
          onClick={() => onBillingChange('annual')}
        >
          Annual
        </span>
        {billingPeriod === 'annual' && (
          <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            Save {savingsPercent}%
          </span>
        )}
      </div>
    </div>
  );
}
