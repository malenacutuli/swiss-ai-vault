import { ShieldCheck } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function E2EEncryptedBadge() {
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
            <span>E2E Encrypted</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-sm">
            Your messages are encrypted end-to-end using AES-256-GCM. 
            Only you can read them.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
