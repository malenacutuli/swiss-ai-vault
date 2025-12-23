import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwissInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "underline" | "ghost";
  error?: boolean;
}

const SwissInput = React.forwardRef<HTMLInputElement, SwissInputProps>(
  ({ className, type, variant = "default", error = false, ...props }, ref) => {
    const variants = {
      default: cn(
        "flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm",
        "placeholder:text-muted-foreground",
        "focus:outline-none focus:border-swiss-navy focus:ring-1 focus:ring-swiss-navy/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "transition-all duration-200 ease-in-out"
      ),
      underline: cn(
        "flex h-10 w-full border-0 border-b border-border bg-transparent px-0 py-2 text-sm",
        "placeholder:text-muted-foreground",
        "focus:outline-none focus:border-swiss-navy",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "transition-all duration-200 ease-in-out"
      ),
      ghost: cn(
        "flex h-10 w-full rounded-md bg-transparent px-3 py-2 text-sm",
        "placeholder:text-muted-foreground",
        "hover:bg-muted/50",
        "focus:outline-none focus:bg-muted",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "transition-all duration-200 ease-in-out"
      ),
    };

    return (
      <input
        type={type}
        className={cn(
          variants[variant],
          error && "border-destructive focus:border-destructive focus:ring-destructive/20",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
SwissInput.displayName = "SwissInput";

export { SwissInput };
