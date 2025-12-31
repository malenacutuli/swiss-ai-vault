import { cn } from '@/lib/utils';

interface PricingTabsProps {
  activeTab: 'personal' | 'business';
  onTabChange: (tab: 'personal' | 'business') => void;
}

export function PricingTabs({ activeTab, onTabChange }: PricingTabsProps) {
  return (
    <div className="inline-flex items-center rounded-full bg-muted/60 p-1 border border-border/40">
      <button
        onClick={() => onTabChange('personal')}
        className={cn(
          'px-6 py-2 text-sm font-medium rounded-full transition-all duration-200',
          activeTab === 'personal'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Personal
      </button>
      <button
        onClick={() => onTabChange('business')}
        className={cn(
          'px-6 py-2 text-sm font-medium rounded-full transition-all duration-200',
          activeTab === 'business'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Business
      </button>
    </div>
  );
}
