import { useTranslation } from 'react-i18next';
import { ShieldCheck } from '@/icons';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function E2EEncryptedBadge() {
  const { t } = useTranslation();
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-full cursor-default",
              "bg-success/10 text-success border border-success/20",
              "text-xs font-medium",
              "hover:scale-105 transition-transform duration-200"
            )}
          >
            <ShieldCheck className="h-3.5 w-3.5 animate-[pulse_5s_ease-in-out_infinite]" />
            <span>{t('vaultChat.encryption.badge')}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-sm">
            {t('vaultChat.encryption.tooltip')}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
