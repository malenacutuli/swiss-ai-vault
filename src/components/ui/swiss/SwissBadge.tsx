import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const swissBadgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider transition-colors",
  {
    variants: {
      variant: {
        default: "bg-muted text-muted-foreground",
        private: "bg-swiss-navy/10 text-swiss-navy border border-swiss-navy/20",
        success: "bg-success/10 text-success border border-success/20",
        new: "bg-swiss-burgundy/10 text-swiss-burgundy border border-swiss-burgundy/20",
        warning: "bg-warning/10 text-warning border border-warning/20",
        info: "bg-swiss-sapphire/10 text-swiss-sapphire border border-swiss-sapphire/20",
        beta: "bg-badge-beta/10 text-badge-beta border border-badge-beta/20",
        vision: "bg-badge-vision/10 text-badge-vision border border-badge-vision/20",
        reasoning: "bg-badge-reasoning/10 text-badge-reasoning border border-badge-reasoning/20",
        audio: "bg-badge-audio/10 text-badge-audio border border-badge-audio/20",
        outline: "border border-border text-muted-foreground",
      },
      size: {
        default: "h-5 text-[10px]",
        sm: "h-4 text-[9px] px-1.5",
        lg: "h-6 text-xs px-2.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface SwissBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof swissBadgeVariants> {
  icon?: React.ReactNode;
}

const SwissBadge = React.forwardRef<HTMLSpanElement, SwissBadgeProps>(
  ({ className, variant, size, icon, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(swissBadgeVariants({ variant, size }), className)}
        {...props}
      >
        {icon && <span className="[&>svg]:size-3">{icon}</span>}
        {children}
      </span>
    );
  }
);
SwissBadge.displayName = "SwissBadge";

// Helper to map model tags to badge variants
export function getTagBadgeVariant(tag: string): SwissBadgeProps["variant"] {
  const mapping: Record<string, SwissBadgeProps["variant"]> = {
    private: "private",
    default: "success",
    new: "new",
    "pay-per-use": "warning",
    anonymized: "info",
    beta: "beta",
    vision: "vision",
    reasoning: "reasoning",
    audio: "audio",
  };
  return mapping[tag] || "default";
}

export { SwissBadge, swissBadgeVariants };
