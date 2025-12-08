import { Shield, Clock, Archive, Database } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type RetentionMode = 'zerotrace' | '1day' | '1week' | '90days' | 'forever';

interface RetentionOption {
  id: RetentionMode;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  retentionDays: number | null;
}

const RETENTION_OPTIONS: RetentionOption[] = [
  {
    id: 'zerotrace',
    label: 'ZeroTrace',
    description: 'No data retention. Encrypted & deleted immediately.',
    icon: Shield,
    color: 'text-green-600 dark:text-green-400',
    retentionDays: 0
  },
  {
    id: '1day',
    label: 'Keep 1 day',
    description: 'Encrypted messages deleted after 24 hours.',
    icon: Clock,
    color: 'text-blue-600 dark:text-blue-400',
    retentionDays: 1
  },
  {
    id: '1week',
    label: 'Keep 1 week',
    description: 'Encrypted messages deleted after 7 days.',
    icon: Clock,
    color: 'text-purple-600 dark:text-purple-400',
    retentionDays: 7
  },
  {
    id: '90days',
    label: 'Keep 90 days',
    description: 'Encrypted messages deleted after 90 days.',
    icon: Archive,
    color: 'text-orange-600 dark:text-orange-400',
    retentionDays: 90
  },
  {
    id: 'forever',
    label: 'Keep forever',
    description: 'Encrypted messages stored permanently.',
    icon: Database,
    color: 'text-muted-foreground',
    retentionDays: null
  },
];

interface RetentionModeDropdownProps {
  value: RetentionMode;
  onChange: (mode: RetentionMode) => void;
  disabled?: boolean;
}

export function RetentionModeDropdown({ value, onChange, disabled }: RetentionModeDropdownProps) {
  const selectedOption = RETENTION_OPTIONS.find(o => o.id === value) || RETENTION_OPTIONS[0];
  const Icon = selectedOption.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn(
            "gap-2 h-9 px-3",
            value === 'zerotrace' && "border-green-300 bg-green-50 hover:bg-green-100 dark:border-green-800 dark:bg-green-950/30"
          )}
        >
          <Icon className={cn("h-4 w-4", selectedOption.color)} />
          <span className="hidden sm:inline">{selectedOption.label}</span>
          <span className="sm:hidden">Mode</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64 bg-popover border border-border z-50">
        <div className="px-2 py-1.5">
          <p className="text-xs font-medium text-muted-foreground">Data Retention</p>
        </div>
        <DropdownMenuSeparator />

        {RETENTION_OPTIONS.map((option) => {
          const OptionIcon = option.icon;
          const isSelected = value === option.id;

          return (
            <DropdownMenuItem
              key={option.id}
              onClick={() => onChange(option.id)}
              className={cn(
                "flex items-start gap-3 py-2 cursor-pointer",
                isSelected && "bg-muted"
              )}
            >
              <OptionIcon className={cn("h-4 w-4 mt-0.5 shrink-0", option.color)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{option.label}</span>
                  {option.id === 'zerotrace' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      MOST SECURE
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {option.description}
                </p>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
