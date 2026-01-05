import { cn } from '@/lib/utils';

interface EmptyTaskStateProps {
  className?: string;
  variant?: 'active' | 'recent';
}

export function EmptyTaskState({ className, variant = 'active' }: EmptyTaskStateProps) {
  const message = variant === 'active'
    ? 'No tasks running. Start a new task above.'
    : 'No recent tasks yet.';

  return (
    <div className={cn(
      'flex items-center justify-center py-12 px-4',
      'rounded-lg border border-dashed border-border bg-muted/10',
      className
    )}>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
