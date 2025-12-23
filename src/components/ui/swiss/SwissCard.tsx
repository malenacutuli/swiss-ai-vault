import * as React from "react";
import { cn } from "@/lib/utils";

interface SwissCardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  interactive?: boolean;
  noPadding?: boolean;
}

const SwissCard = React.forwardRef<HTMLDivElement, SwissCardProps>(
  ({ className, elevated = false, interactive = false, noPadding = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-md border border-border bg-card",
          !noPadding && "p-6",
          elevated && "shadow-[0_2px_8px_rgba(0,0,0,0.04)]",
          interactive && "transition-all duration-200 ease-in-out hover:border-muted-foreground/20 hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)]",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
SwissCard.displayName = "SwissCard";

const SwissCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 pb-4", className)}
    {...props}
  />
));
SwissCardHeader.displayName = "SwissCardHeader";

const SwissCardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement> & { caps?: boolean }
>(({ className, caps = false, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "font-serif font-semibold leading-none tracking-tight",
      caps && "uppercase tracking-[0.1em] text-sm",
      className
    )}
    {...props}
  />
));
SwissCardTitle.displayName = "SwissCardTitle";

const SwissCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
SwissCardDescription.displayName = "SwissCardDescription";

const SwissCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("", className)} {...props} />
));
SwissCardContent.displayName = "SwissCardContent";

const SwissCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center pt-4", className)}
    {...props}
  />
));
SwissCardFooter.displayName = "SwissCardFooter";

export {
  SwissCard,
  SwissCardHeader,
  SwissCardTitle,
  SwissCardDescription,
  SwissCardContent,
  SwissCardFooter,
};
