import * as React from "react";
import { cn } from "@/lib/utils";

interface SwissIconTileProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'muted' | 'accent' | 'outlined';
}

const SwissIconTile = React.forwardRef<HTMLDivElement, SwissIconTileProps>(
  ({ children, size = 'md', variant = 'default', className, ...props }, ref) => {
    const sizeStyles = {
      xs: "w-6 h-6 rounded [&>svg]:w-3 [&>svg]:h-3",
      sm: "w-8 h-8 rounded-md [&>svg]:w-4 [&>svg]:h-4",
      md: "w-10 h-10 rounded-lg [&>svg]:w-5 [&>svg]:h-5",
      lg: "w-12 h-12 rounded-xl [&>svg]:w-6 [&>svg]:h-6",
      xl: "w-14 h-14 rounded-xl [&>svg]:w-7 [&>svg]:h-7",
    };
    
    const variantStyles = {
      default: "bg-primary/10 text-primary",
      muted: "bg-muted text-muted-foreground",
      accent: "bg-primary text-primary-foreground",
      outlined: "bg-transparent border border-border text-muted-foreground",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-center flex-shrink-0",
          sizeStyles[size],
          variantStyles[variant],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

SwissIconTile.displayName = "SwissIconTile";

export { SwissIconTile };
export type { SwissIconTileProps };
