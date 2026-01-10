import { Link } from "react-router-dom";
import { Coins, AlertCircle, Zap, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useUserCredits } from "@/hooks/useUserCredits";

interface CreditsDisplayProps {
  variant?: 'compact' | 'full';
  showUpgrade?: boolean;
  className?: string;
}

export const CreditsDisplay = ({ 
  variant = 'compact', 
  showUpgrade = true,
  className 
}: CreditsDisplayProps) => {
  const { credits, loading } = useUserCredits();

  if (loading) {
    return <Skeleton className="h-8 w-24 rounded-full" />;
  }

  if (credits === null) {
    return null;
  }

  const isLow = credits < 1;
  const isCritical = credits < 0.25;

  if (variant === 'full') {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <div className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-xl border transition-all",
          isCritical 
            ? "bg-red-50 border-red-200 text-red-700"
            : isLow 
            ? "bg-amber-50 border-amber-200 text-amber-700"
            : "bg-emerald-50 border-emerald-200 text-emerald-700"
        )}>
          <Coins className="h-4 w-4" />
          <div className="flex flex-col">
            <span className="text-xs font-medium opacity-70">Balance</span>
            <span className="text-lg font-bold font-mono leading-none">
              €{credits.toFixed(2)}
            </span>
          </div>
          {isLow && <AlertCircle className="h-4 w-4" />}
        </div>
        
        {showUpgrade && (
          <Link to="/ghost/billing">
            <Button 
              size="sm" 
              className="bg-[#1D4E5F] hover:bg-[#163d4a] text-white gap-1.5"
            >
              <Zap className="h-3.5 w-3.5" />
              Top Up
            </Button>
          </Link>
        )}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link to="/ghost/billing">
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full transition-all cursor-pointer",
                isCritical
                  ? "bg-red-100 text-red-700 hover:bg-red-200"
                  : isLow
                  ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                  : "bg-[#F0F9F4] text-[#1D4E5F] hover:bg-[#E0F2E9]",
                className
              )}
            >
              <Coins className="h-4 w-4" />
              <span className="text-sm font-semibold font-mono">
                €{credits.toFixed(2)}
              </span>
              {isLow && <AlertCircle className="h-3.5 w-3.5" />}
            </div>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <p>{isLow ? 'Low balance - click to top up' : 'Your credit balance'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
