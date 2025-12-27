import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Zap, Image, Crown, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GhostUsageDisplayProps {
  tier: 'ghost_free' | 'ghost_pro' | 'swissvault_pro' | 'free' | 'pro';
  remaining: {
    prompts: number;
    images: number;
    videos: number;
    files: number;
    searches: number;
  };
  limits: {
    prompts: number;
    images: number;
    videos: number;
    files: number;
    searches: number;
  };
  resetTime: Date;
  className?: string;
}

export function GhostUsageDisplay({
  tier,
  remaining,
  limits,
  resetTime,
  className,
}: GhostUsageDisplayProps) {
  const isPro = tier === 'pro' || tier === 'ghost_pro' || tier === 'swissvault_pro';
  const isSwissVaultPro = tier === 'swissvault_pro';

  const getTimeUntilReset = () => {
    const now = new Date();
    const diff = resetTime.getTime() - now.getTime();
    if (diff <= 0) return 'soon';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (isPro) {
    return (
      <Badge variant="outline" className={cn('bg-primary/10 text-primary border-primary/20', className)}>
        <Crown className="w-3 h-3 mr-1" />
        {isSwissVaultPro ? 'SWISSVAULT PRO' : 'PRO'}
      </Badge>
    );
  }

  const promptsLow = remaining.prompts <= 3;
  const imagesLow = remaining.images <= 1;

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* Prompts remaining */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs',
            promptsLow 
              ? 'bg-destructive/10 text-destructive' 
              : 'bg-muted/50 text-muted-foreground'
          )}>
            <Zap className="w-3.5 h-3.5" />
            <span className="font-medium tabular-nums">
              {remaining.prompts}/{limits.prompts}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{remaining.prompts} prompts remaining today</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            <Clock className="w-3 h-3" />
            Resets in {getTimeUntilReset()}
          </p>
        </TooltipContent>
      </Tooltip>

      {/* Images remaining */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs',
            imagesLow 
              ? 'bg-destructive/10 text-destructive' 
              : 'bg-muted/50 text-muted-foreground'
          )}>
            <Image className="w-3.5 h-3.5" />
            <span className="font-medium tabular-nums">
              {remaining.images}/{limits.images}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{remaining.images} images remaining today</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            <Clock className="w-3 h-3" />
            Resets in {getTimeUntilReset()}
          </p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
