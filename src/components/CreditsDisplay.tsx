import { Link } from "react-router-dom";
import { Coins, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useUserCredits } from "@/hooks/useUserCredits";

export const CreditsDisplay = () => {
  const { credits, loading } = useUserCredits();

  if (loading) {
    return <Skeleton className="h-8 w-24 rounded-full" />;
  }

  if (credits === null) {
    return null;
  }

  const isLow = credits < 1;

  return (
    <Link to="/dashboard/billing">
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors",
          isLow
            ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
            : "bg-secondary text-foreground hover:bg-secondary/80"
        )}
      >
        <Coins className="h-4 w-4" />
        <span className="text-sm font-medium font-mono">
          ${credits.toFixed(2)}
        </span>
        {isLow && <AlertCircle className="h-4 w-4" />}
      </div>
    </Link>
  );
};
