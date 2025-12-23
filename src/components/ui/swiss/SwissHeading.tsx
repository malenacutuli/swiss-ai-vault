import * as React from "react";
import { cn } from "@/lib/utils";

type HeadingLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

interface SwissHeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: HeadingLevel;
  caps?: boolean;
  serif?: boolean;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
}

const sizeClasses = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
  "3xl": "text-3xl",
};

const SwissHeading = React.forwardRef<HTMLHeadingElement, SwissHeadingProps>(
  ({ className, as: Component = "h2", caps = false, serif = true, size, children, ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={cn(
          serif ? "font-serif" : "font-sans",
          "font-semibold leading-tight",
          caps && "uppercase tracking-[0.1em]",
          !caps && "tracking-tight",
          size && sizeClasses[size],
          className
        )}
        {...props}
      >
        {children}
      </Component>
    );
  }
);
SwissHeading.displayName = "SwissHeading";

export { SwissHeading };
