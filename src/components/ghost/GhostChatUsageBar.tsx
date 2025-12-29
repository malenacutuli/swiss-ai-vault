import { useState, useEffect } from 'react';
import { MessageSquare, Image, Video, Search, Clock, ChevronUp, ChevronDown } from '@/icons';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface UsageItem {
  used: number;
  limit: number;
}

interface GhostChatUsageBarProps {
  usage: {
    prompts: UsageItem;
    images: UsageItem;
    videos: UsageItem;
    research: UsageItem;
  };
  resetsIn?: number; // seconds
  tier: 'anonymous' | 'free' | 'ghost' | 'pro' | 'ultra';
  onUpgrade?: () => void;
  className?: string;
}

export function GhostChatUsageBar({ 
  usage, 
  resetsIn, 
  tier, 
  onUpgrade,
  className 
}: GhostChatUsageBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [timeUntilReset, setTimeUntilReset] = useState(resetsIn || 0);
  
  // Countdown timer
  useEffect(() => {
    if (!resetsIn) return;
    setTimeUntilReset(resetsIn);
    const interval = setInterval(() => {
      setTimeUntilReset(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resetsIn]);
  
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };
  
  const getProgressColor = (used: number, limit: number) => {
    if (limit === -1) return 'bg-primary'; // Unlimited
    const percent = (used / limit) * 100;
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 70) return 'bg-yellow-500';
    return 'bg-primary';
  };
  
  const getRemainingText = (used: number, limit: number) => {
    if (limit === -1) return '∞';
    return `${limit - used}`;
  };
  
  const isLimitReached = (item: UsageItem) => 
    item.limit !== -1 && item.used >= item.limit;
  
  const anyLimitLow = 
    (usage.prompts.limit !== -1 && usage.prompts.limit - usage.prompts.used <= 3) ||
    (usage.images.limit !== -1 && usage.images.limit - usage.images.used <= 1) ||
    (usage.research.limit !== -1 && usage.research.limit - usage.research.used <= 1);

  return (
    <div className={cn(
      "bg-muted/50 rounded-t-lg border border-b-0 border-border/40",
      anyLimitLow && "border-yellow-500/50",
      className
    )}>
      {/* Collapsed View - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2 flex items-center justify-between text-sm"
      >
        <div className="flex items-center gap-4">
          {/* Prompts */}
          <div className="flex items-center gap-1.5">
            <MessageSquare className={cn(
              "h-3.5 w-3.5",
              isLimitReached(usage.prompts) ? "text-red-500" : "text-muted-foreground"
            )} />
            <span className={cn(
              "font-medium",
              isLimitReached(usage.prompts) ? "text-red-500" : "text-foreground"
            )}>
              {getRemainingText(usage.prompts.used, usage.prompts.limit)}
            </span>
          </div>
          
          {/* Images */}
          <div className="flex items-center gap-1.5">
            <Image className={cn(
              "h-3.5 w-3.5",
              isLimitReached(usage.images) ? "text-red-500" : "text-muted-foreground"
            )} />
            <span className={cn(
              "font-medium",
              isLimitReached(usage.images) ? "text-red-500" : "text-foreground"
            )}>
              {getRemainingText(usage.images.used, usage.images.limit)}
            </span>
          </div>
          
          {/* Research */}
          <div className="flex items-center gap-1.5">
            <Search className={cn(
              "h-3.5 w-3.5",
              isLimitReached(usage.research) ? "text-red-500" : "text-muted-foreground"
            )} />
            <span className={cn(
              "font-medium",
              isLimitReached(usage.research) ? "text-red-500" : "text-foreground"
            )}>
              {getRemainingText(usage.research.used, usage.research.limit)}
            </span>
          </div>
          
          {/* Reset Timer */}
          {timeUntilReset > 0 && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-xs">{formatTime(timeUntilReset)}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {tier === 'anonymous' && (
            <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
              Guest
            </span>
          )}
          {tier === 'free' && (
            <span className="text-xs bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full">
              Free
            </span>
          )}
          {(tier === 'ghost' || tier === 'pro' || tier === 'ultra') && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full capitalize">
              {tier}
            </span>
          )}
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>
      
      {/* Expanded View */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 space-y-3 border-t border-border/40">
          {/* Prompts */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Prompts</span>
              <span className="text-foreground">
                {usage.prompts.used}/{usage.prompts.limit === -1 ? '∞' : usage.prompts.limit}
              </span>
            </div>
            <Progress 
              value={usage.prompts.limit === -1 ? 10 : (usage.prompts.used / usage.prompts.limit) * 100} 
              className={cn("h-1.5", getProgressColor(usage.prompts.used, usage.prompts.limit))}
            />
          </div>
          
          {/* Images */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Images</span>
              <span className="text-foreground">
                {usage.images.used}/{usage.images.limit === -1 ? '∞' : usage.images.limit}
              </span>
            </div>
            <Progress 
              value={usage.images.limit === -1 ? 10 : (usage.images.used / usage.images.limit) * 100} 
              className={cn("h-1.5", getProgressColor(usage.images.used, usage.images.limit))}
            />
          </div>
          
          {/* Videos */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Videos</span>
              <span className="text-foreground">
                {usage.videos.used}/{usage.videos.limit === -1 ? '∞' : usage.videos.limit}
              </span>
            </div>
            <Progress 
              value={usage.videos.limit === -1 ? 10 : (usage.videos.used / usage.videos.limit) * 100} 
              className={cn("h-1.5", getProgressColor(usage.videos.used, usage.videos.limit))}
            />
          </div>
          
          {/* Deep Research */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Deep Research</span>
              <span className="text-foreground">
                {usage.research.used}/{usage.research.limit === -1 ? '∞' : usage.research.limit}
              </span>
            </div>
            <Progress 
              value={usage.research.limit === -1 ? 10 : (usage.research.used / usage.research.limit) * 100} 
              className={cn("h-1.5", getProgressColor(usage.research.used, usage.research.limit))}
            />
          </div>
          
          {/* Upgrade CTA */}
          {(tier === 'anonymous' || tier === 'free') && (
            <Button onClick={onUpgrade} size="sm" className="w-full mt-2">
              {tier === 'anonymous' ? 'Sign Up Free' : 'Upgrade to Ghost'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
