import { useState } from "react";
import { Link } from "react-router-dom";
import { Coins, AlertCircle, Sparkles, ImageIcon, Video, ChevronRight } from "@/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useGhostCredits } from "@/hooks/useGhostCredits";
import { BuyGhostCreditsModal } from "@/components/ghost/BuyGhostCreditsModal";

type UserTier = "anonymous" | "free" | "pro" | "team" | "enterprise";
type DisplayMode = "compact" | "expanded";

interface CreditsDisplayProps {
  mode?: DisplayMode;
  className?: string;
}

interface UsageData {
  tier: UserTier;
  // Anonymous/Free - daily limits
  textUsed?: number;
  textLimit?: number;
  imageUsed?: number;
  imageLimit?: number;
  // Pro - credit balance + limits
  creditBalance?: number;
  videoUsed?: number;
  videoLimit?: number;
  // Team - usage tracking
  usageAmount?: number;
  trainingUsed?: number;
  trainingLimit?: number;
}

export function CreditsDisplay({ mode = "compact", className }: CreditsDisplayProps) {
  const { user } = useAuth();
  const { balance, isLoading, checkCredits, subscription } = useGhostCredits();
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [usageData, setUsageData] = useState<UsageData | null>(null);

  // Determine tier based on subscription and auth state
  const getTier = (): UserTier => {
    if (!user) return "anonymous";
    if (!subscription) return "free";
    const plan = subscription.plan?.toLowerCase();
    if (plan === "team" || plan === "enterprise") return plan as UserTier;
    if (plan === "pro" || balance > 0) return "pro";
    return "free";
  };

  const tier = getTier();

  // Mock usage data based on tier - in production, fetch from get_billing_status RPC
  const getUsageData = (): UsageData => {
    switch (tier) {
      case "anonymous":
        return { tier, textUsed: 3, textLimit: 5 };
      case "free":
        return { tier, textUsed: 20, textLimit: 25, imageUsed: 9, imageLimit: 15 };
      case "pro":
        return { 
          tier, 
          creditBalance: balance / 100, // Convert to dollars
          imageUsed: 45, 
          imageLimit: 100, 
          videoUsed: 12, 
          videoLimit: 20 
        };
      case "team":
        return { 
          tier, 
          usageAmount: 45.20, 
          trainingUsed: 38.50, 
          trainingLimit: 50 
        };
      default:
        return { tier: "free", textUsed: 0, textLimit: 25 };
    }
  };

  const data = getUsageData();

  const getProgressPercent = (used: number, limit: number) => {
    return Math.min((used / limit) * 100, 100);
  };

  const isLowWarning = (used: number, limit: number) => {
    const remaining = limit - used;
    return remaining / limit < 0.2;
  };

  if (isLoading) {
    return <Skeleton className={cn("h-8 w-24 rounded-lg", className)} />;
  }

  // Compact mode - for header
  if (mode === "compact") {
    return (
      <>
        <button
          onClick={() => setShowBuyModal(true)}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all",
            "bg-secondary/50 hover:bg-secondary border border-border/50",
            "text-sm font-medium",
            className
          )}
        >
          <Coins className="h-4 w-4 text-primary" />
          {tier === "anonymous" && (
            <span className="text-muted-foreground">
              {data.textUsed}/{data.textLimit}
            </span>
          )}
          {tier === "free" && (
            <span className="text-muted-foreground">
              {data.textLimit! - data.textUsed!} left
            </span>
          )}
          {tier === "pro" && (
            <span className="font-mono text-foreground">
              ${data.creditBalance?.toFixed(2)}
            </span>
          )}
          {tier === "team" && (
            <span className="font-mono text-foreground">
              ${data.usageAmount?.toFixed(2)}
            </span>
          )}
          {(tier === "anonymous" || tier === "free") && isLowWarning(data.textUsed!, data.textLimit!) && (
            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
          )}
        </button>
        <BuyGhostCreditsModal open={showBuyModal} onOpenChange={setShowBuyModal} />
      </>
    );
  }

  // Expanded mode - for sidebar
  return (
    <>
      <div
        className={cn(
          "rounded-xl border border-border/50 bg-card/50 p-4 space-y-3",
          className
        )}
      >
        {/* Anonymous User */}
        {tier === "anonymous" && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Guest</span>
              <span className={cn(
                "text-sm font-medium",
                isLowWarning(data.textUsed!, data.textLimit!) ? "text-destructive" : "text-foreground"
              )}>
                {data.textUsed}/{data.textLimit} today
              </span>
            </div>
            <Progress 
              value={getProgressPercent(data.textUsed!, data.textLimit!)} 
              className={cn(
                "h-1.5",
                isLowWarning(data.textUsed!, data.textLimit!) && "[&>div]:bg-destructive"
              )}
            />
            <Link to="/auth">
              <Button variant="outline" size="sm" className="w-full mt-2">
                Create Account
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </>
        )}

        {/* Free User */}
        {tier === "free" && (
          <>
            <div className="text-sm font-medium text-foreground mb-2">Today's Usage</div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5" />
                  Text
                </span>
                <span className={cn(
                  "font-medium",
                  isLowWarning(data.textUsed!, data.textLimit!) ? "text-destructive" : "text-foreground"
                )}>
                  {data.textUsed}/{data.textLimit}
                </span>
              </div>
              <Progress 
                value={getProgressPercent(data.textUsed!, data.textLimit!)} 
                className={cn(
                  "h-1.5",
                  isLowWarning(data.textUsed!, data.textLimit!) && "[&>div]:bg-destructive"
                )}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <ImageIcon className="h-3.5 w-3.5" />
                  Images
                </span>
                <span className={cn(
                  "font-medium",
                  isLowWarning(data.imageUsed!, data.imageLimit!) ? "text-destructive" : "text-foreground"
                )}>
                  {data.imageUsed}/{data.imageLimit}
                </span>
              </div>
              <Progress 
                value={getProgressPercent(data.imageUsed!, data.imageLimit!)} 
                className={cn(
                  "h-1.5",
                  isLowWarning(data.imageUsed!, data.imageLimit!) && "[&>div]:bg-destructive"
                )}
              />
            </div>

            <Button 
              variant="outline" 
              size="sm" 
              className="w-full mt-2"
              onClick={() => setShowBuyModal(true)}
            >
              Upgrade to Pro
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </>
        )}

        {/* Pro User */}
        {tier === "pro" && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Credits</span>
              <span className="text-lg font-semibold font-mono text-foreground">
                ${data.creditBalance?.toFixed(2)}
              </span>
            </div>

            <div className="space-y-2 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <ImageIcon className="h-3.5 w-3.5" />
                  Images
                </span>
                <span className={cn(
                  "font-medium",
                  isLowWarning(data.imageUsed!, data.imageLimit!) ? "text-destructive" : "text-foreground"
                )}>
                  {data.imageUsed}/{data.imageLimit}
                </span>
              </div>
              <Progress 
                value={getProgressPercent(data.imageUsed!, data.imageLimit!)} 
                className={cn(
                  "h-1.5",
                  isLowWarning(data.imageUsed!, data.imageLimit!) && "[&>div]:bg-destructive"
                )}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Video className="h-3.5 w-3.5" />
                  Videos
                </span>
                <span className={cn(
                  "font-medium",
                  isLowWarning(data.videoUsed!, data.videoLimit!) ? "text-destructive" : "text-foreground"
                )}>
                  {data.videoUsed}/{data.videoLimit}
                </span>
              </div>
              <Progress 
                value={getProgressPercent(data.videoUsed!, data.videoLimit!)} 
                className={cn(
                  "h-1.5",
                  isLowWarning(data.videoUsed!, data.videoLimit!) && "[&>div]:bg-destructive"
                )}
              />
            </div>

            <Button 
              variant="outline" 
              size="sm" 
              className="w-full mt-2"
              onClick={() => setShowBuyModal(true)}
            >
              <Coins className="h-4 w-4 mr-1.5" />
              Top Up
            </Button>
          </>
        )}

        {/* Team User */}
        {tier === "team" && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Usage</span>
              <span className="text-lg font-semibold font-mono text-foreground">
                ${data.usageAmount?.toFixed(2)}
              </span>
            </div>

            <div className="space-y-2 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Training Budget</span>
                <span className={cn(
                  "font-medium",
                  isLowWarning(data.trainingUsed!, data.trainingLimit!) ? "text-destructive" : "text-foreground"
                )}>
                  ${data.trainingUsed?.toFixed(2)}/${data.trainingLimit}
                </span>
              </div>
              <Progress 
                value={getProgressPercent(data.trainingUsed!, data.trainingLimit!)} 
                className={cn(
                  "h-1.5",
                  isLowWarning(data.trainingUsed!, data.trainingLimit!) && "[&>div]:bg-destructive"
                )}
              />
            </div>

            <Button 
              variant="outline" 
              size="sm" 
              className="w-full mt-2"
              onClick={() => setShowBuyModal(true)}
            >
              <Coins className="h-4 w-4 mr-1.5" />
              Top Up
            </Button>
          </>
        )}

        {/* Enterprise - minimal display */}
        {tier === "enterprise" && (
          <div className="text-sm text-muted-foreground text-center py-2">
            Enterprise Plan
          </div>
        )}
      </div>
      <BuyGhostCreditsModal open={showBuyModal} onOpenChange={setShowBuyModal} />
    </>
  );
}

// Re-export for backward compatibility
export { CreditsDisplay as UnifiedCreditsDisplay };
