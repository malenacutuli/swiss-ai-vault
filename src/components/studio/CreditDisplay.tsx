import React from 'react';
import { Coins } from 'lucide-react';
import { useCredits } from '@/hooks/useCredits';
import { cn } from '@/lib/utils';

interface CreditDisplayProps {
  className?: string;
  showLabel?: boolean;
}

export function CreditDisplay({ className, showLabel = true }: CreditDisplayProps) {
  const { credits, isLoading } = useCredits();

  const isLow = credits.totalAvailable < 20;
  const isCritical = credits.totalAvailable < 5;

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm",
      "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800",
      isCritical && "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
      className
    )}>
      <Coins className={cn(
        "w-4 h-4",
        isCritical ? "text-red-500" : isLow ? "text-amber-600" : "text-amber-500"
      )} />
      <span className={cn(
        "font-semibold tabular-nums",
        isCritical ? "text-red-600" : isLow ? "text-amber-700" : "text-amber-600"
      )}>
        {isLoading ? '...' : credits.totalAvailable}
      </span>
      {showLabel && (
        <span className="text-muted-foreground text-xs">credits</span>
      )}
    </div>
  );
}
