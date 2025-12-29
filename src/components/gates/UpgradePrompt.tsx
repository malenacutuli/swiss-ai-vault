import { Link } from "react-router-dom";
import { Check, Lock, Sparkles } from "@/icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface UpgradePromptProps {
  title: string;
  description?: string;
  features: string[];
  targetTier: "pro" | "team" | "enterprise";
  price: string;
  className?: string;
  compact?: boolean;
}

const tierConfig = {
  pro: {
    name: "Pro",
    gradient: "from-primary/20 to-primary/5",
    accent: "text-primary",
    badge: "bg-primary/10 text-primary border-primary/20",
  },
  team: {
    name: "Team",
    gradient: "from-amber-500/20 to-amber-500/5",
    accent: "text-amber-500",
    badge: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  },
  enterprise: {
    name: "Enterprise",
    gradient: "from-purple-500/20 to-purple-500/5",
    accent: "text-purple-500",
    badge: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  },
};

export const UpgradePrompt = ({
  title,
  description,
  features,
  targetTier,
  price,
  className,
  compact = false,
}: UpgradePromptProps) => {
  const config = tierConfig[targetTier];

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/30",
          className
        )}
      >
        <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm text-muted-foreground flex-1">{title}</span>
        <Button asChild size="sm" variant="outline" className={config.accent}>
          <Link to="/labs/billing">Upgrade to {config.name}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center min-h-[400px] p-8",
        className
      )}
    >
      <div
        className={cn(
          "w-full max-w-md p-8 rounded-2xl border border-border/50 bg-gradient-to-b",
          config.gradient
        )}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div
            className={cn(
              "w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center",
              "bg-background border border-border/50"
            )}
          >
            <Lock className={cn("w-6 h-6", config.accent)} />
          </div>

          <Badge variant="outline" className={cn("mb-3", config.badge)}>
            <Sparkles className="w-3 h-3 mr-1" />
            {config.name} Feature
          </Badge>

          <h2 className="font-serif text-2xl font-bold mb-2">{title}</h2>

          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>

        {/* Features */}
        <ul className="space-y-3 mb-6">
          {features.map((feature, i) => (
            <li key={i} className="flex items-start gap-3">
              <div
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                  "bg-background border border-border/50"
                )}
              >
                <Check className={cn("w-3 h-3", config.accent)} />
              </div>
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-3">
            Starting at{" "}
            <span className={cn("font-semibold", config.accent)}>{price}</span>
          </p>
          <Button asChild className="w-full" size="lg">
            <Link to="/labs/billing">Upgrade to {config.name}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};
