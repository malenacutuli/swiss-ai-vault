import { cn } from '@/lib/utils';

export type PrivacyTier = 'ghost' | 'vault' | 'full';

interface PrivacyTierSelectorProps {
  value: PrivacyTier;
  onChange: (tier: PrivacyTier) => void;
}

const tiers: { id: PrivacyTier; label: string }[] = [
  { id: 'ghost', label: 'Ghost' },
  { id: 'vault', label: 'Vault' },
  { id: 'full', label: 'Full' },
];

export function PrivacyTierSelector({ value, onChange }: PrivacyTierSelectorProps) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
      {tiers.map((tier) => (
        <button
          key={tier.id}
          type="button"
          onClick={() => onChange(tier.id)}
          className={cn(
            'px-3 py-1 text-xs font-medium rounded-md transition-colors',
            value === tier.id
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {tier.label}
        </button>
      ))}
    </div>
  );
}
