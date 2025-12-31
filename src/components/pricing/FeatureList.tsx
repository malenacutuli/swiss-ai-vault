import { Check } from '@/icons';
import { cn } from '@/lib/utils';

interface FeatureListProps {
  features: string[];
  className?: string;
}

export function FeatureList({ features, className }: FeatureListProps) {
  return (
    <ul className={cn('space-y-3', className)}>
      {features.map((feature, index) => (
        <li key={index} className="flex items-start gap-3 text-sm text-foreground/80">
          <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  );
}
