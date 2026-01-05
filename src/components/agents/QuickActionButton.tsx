import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface QuickActionButtonProps {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  isActive?: boolean;
}

export function QuickActionButton({ icon: Icon, label, onClick, isActive }: QuickActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm',
        'border border-border bg-card/50 transition-all',
        'hover:bg-muted hover:border-muted-foreground/30',
        isActive && 'bg-primary/10 border-primary/30 text-primary'
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  );
}
