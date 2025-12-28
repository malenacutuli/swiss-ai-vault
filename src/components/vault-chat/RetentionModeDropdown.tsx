import { useTranslation } from 'react-i18next';
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
  labelKey: string;
  descriptionKey: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  retentionDays: number | null;
}

const RETENTION_OPTIONS: RetentionOption[] = [
  {
    id: 'zerotrace',
    labelKey: 'vaultChat.retention.zerotrace.label',
    descriptionKey: 'vaultChat.retention.zerotrace.description',
    icon: Shield,
    color: 'text-green-600 dark:text-green-400',
    retentionDays: 0
  },
  {
    id: '1day',
    labelKey: 'vaultChat.retention.1day.label',
    descriptionKey: 'vaultChat.retention.1day.description',
    icon: Clock,
    color: 'text-blue-600 dark:text-blue-400',
    retentionDays: 1
  },
  {
    id: '1week',
    labelKey: 'vaultChat.retention.1week.label',
    descriptionKey: 'vaultChat.retention.1week.description',
    icon: Clock,
    color: 'text-purple-600 dark:text-purple-400',
    retentionDays: 7
  },
  {
    id: '90days',
    labelKey: 'vaultChat.retention.90days.label',
    descriptionKey: 'vaultChat.retention.90days.description',
    icon: Archive,
    color: 'text-orange-600 dark:text-orange-400',
    retentionDays: 90
  },
  {
    id: 'forever',
    labelKey: 'vaultChat.retention.forever.label',
    descriptionKey: 'vaultChat.retention.forever.description',
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
  const { t } = useTranslation();
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
            value === 'zerotrace' && "border-green-500/50 bg-green-50 hover:bg-green-100 text-green-700 dark:border-green-500/40 dark:bg-green-950/50 dark:text-green-300 dark:hover:bg-green-900/50"
          )}
        >
          <Icon className={cn("h-4 w-4", selectedOption.color)} />
          <span className={cn(
            "hidden sm:inline font-medium",
            value === 'zerotrace' && "text-green-700 dark:text-green-300"
          )}>
            {t(selectedOption.labelKey)}
          </span>
          <span className="sm:hidden">{t('vaultChat.retention.mode')}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64 bg-popover border border-border z-50">
        <div className="px-2 py-1.5">
          <p className="text-xs font-medium text-muted-foreground">{t('vaultChat.retention.title')}</p>
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
                  <span className="font-medium">{t(option.labelKey)}</span>
                  {option.id === 'zerotrace' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      {t('vaultChat.retention.mostSecure')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t(option.descriptionKey)}
                </p>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
