import { ChevronRight, Wallet, Settings, Crown, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';
import { useUserCredits } from '@/hooks/useUserCredits';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface AgentsHeaderProps {
  sidebarWidth?: number;
}

export function AgentsHeader({ sidebarWidth = 280 }: AgentsHeaderProps) {
  const { subscription, isLoading: subLoading } = useSubscription();
  const { credits, loading: creditsLoading } = useUserCredits();
  
  const tier = subscription?.tier;
  const tierLabel = tier === 'ghost_free' ? 'Free' : tier === 'ghost_pro' ? 'Pro' : tier || 'Free';
  const isFree = tier === 'ghost_free' || !tier;
  
  const isLowCredits = (credits ?? 0) < 2;
  const displayCredits = credits ?? 0;

  return (
    <header 
      className="h-14 bg-white border-b border-[#E5E5E5] flex items-center justify-between px-6 sticky top-0 z-30"
    >
      {/* Breadcrumb */}
      <nav className="flex items-center text-sm" aria-label="Breadcrumb">
        <Link to="/ghost" className="text-[#666666] hover:text-[#1A1A1A] transition-colors">
          Dashboard
        </Link>
        <ChevronRight className="w-4 h-4 mx-2 text-[#CCCCCC]" aria-hidden="true" />
        <span className="font-medium text-[#1A1A1A]">Swiss Agents</span>
      </nav>
      
      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Plan indicator */}
        <div className="flex items-center gap-2 text-sm">
          <span className={cn(
            "px-2 py-0.5 rounded-full text-xs font-medium",
            isFree 
              ? "bg-[#F0F0F0] text-[#666666]" 
              : "bg-[#1D4E5F]/10 text-[#1D4E5F]"
          )}>
            {tierLabel}
          </span>
          {isFree && (
            <Button 
              variant="ghost" 
              size="sm"
              className="text-[#1D4E5F] hover:text-[#1D4E5F]/80 hover:bg-[#1D4E5F]/5 h-7 px-2 gap-1"
              asChild
            >
              <Link to="/ghost/upgrade">
                <Crown className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Upgrade</span>
              </Link>
            </Button>
          )}
        </div>
        
        {/* Credits */}
        <Link to="/ghost/billing">
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all cursor-pointer",
            isLowCredits 
              ? "bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100" 
              : "bg-[#F0F9F4] text-[#1D4E5F] hover:bg-[#E0F2E9]"
          )}>
            {creditsLoading ? (
              <Skeleton className="h-4 w-16" />
            ) : (
              <>
                <Wallet className="w-4 h-4" aria-hidden="true" />
                <span className="font-semibold text-sm font-mono">€{displayCredits.toFixed(2)}</span>
                {isLowCredits && (
                  <Button 
                    size="sm" 
                    className="h-5 px-1.5 text-[10px] bg-amber-600 hover:bg-amber-700 ml-1"
                  >
                    <Zap className="w-3 h-3 mr-0.5" />
                    Top Up
                  </Button>
                )}
              </>
            )}
          </div>
        </Link>
        
        {/* Settings */}
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-[#666666] hover:text-[#1A1A1A] hover:bg-[#F5F5F5] h-8 w-8 p-0"
          asChild
        >
          <Link to="/ghost/settings">
            <Settings className="w-4 h-4" />
            <span className="sr-only">Settings</span>
          </Link>
        </Button>
      </div>
    </header>
  );
}
