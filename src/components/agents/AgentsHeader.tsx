import { ChevronRight, Wallet, Settings, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';
import { Link } from 'react-router-dom';

interface AgentsHeaderProps {
  sidebarWidth?: number;
}

export function AgentsHeader({ sidebarWidth = 256 }: AgentsHeaderProps) {
  const { subscription, isLoading } = useSubscription();
  
  // Mock credits for now - should come from subscription hook
  const credits = 22.06;
  
  const tier = subscription?.tier;
  const tierLabel = tier === 'ghost_free' ? 'Free' : tier === 'ghost_pro' ? 'Pro' : tier || 'Free';
  const isFree = tier === 'ghost_free' || !tier;

  return (
    <header 
      className="h-14 bg-white border-b border-[#E5E5E5] flex items-center justify-between px-6 sticky top-0 z-30"
      style={{ marginLeft: sidebarWidth }}
    >
      {/* Breadcrumb */}
      <nav className="flex items-center text-sm" aria-label="Breadcrumb">
        <Link to="/dashboard" className="text-[#666666] hover:text-[#1A1A1A] transition-colors">
          Dashboard
        </Link>
        <ChevronRight className="w-4 h-4 mx-2 text-[#CCCCCC]" aria-hidden="true" />
        <span className="font-medium text-[#1A1A1A]">Swiss Agents</span>
      </nav>
      
      {/* Right side */}
      <div className="flex items-center gap-5">
        {/* Plan indicator */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[#666666]">{tierLabel}</span>
          {isFree && (
            <Button 
              variant="link" 
              className="text-primary hover:text-primary/80 p-0 h-auto font-medium"
              asChild
            >
              <Link to="/upgrade">
                <Crown className="w-3.5 h-3.5 mr-1" />
                Upgrade
              </Link>
            </Button>
          )}
        </div>
        
        {/* Credits */}
        <div className="flex items-center gap-1.5 text-sm">
          <Wallet className="w-4 h-4 text-[#666666]" aria-hidden="true" />
          <span className="font-medium text-[#1A1A1A]">€{credits.toFixed(2)}</span>
        </div>
        
        {/* Settings */}
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-[#666666] hover:text-[#1A1A1A] hover:bg-[#F5F5F5]"
          asChild
        >
          <Link to="/settings">
            <Settings className="w-4 h-4" />
            <span className="sr-only">Settings</span>
          </Link>
        </Button>
      </div>
    </header>
  );
}
