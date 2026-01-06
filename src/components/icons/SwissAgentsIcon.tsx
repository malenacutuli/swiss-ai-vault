import { cn } from "@/lib/utils";
import swissAgentsIcon from "@/assets/swiss-agents-icon.png";

interface SwissAgentsIconProps {
  className?: string;
  size?: number;
}

// Functional component that mimics Lucide icon signature (accepts className)
export const SwissAgentsIcon = ({ className, size }: SwissAgentsIconProps) => {
  return (
    <img
      src={swissAgentsIcon}
      alt=""
      loading="eager"
      decoding="async"
      draggable={false}
      className={cn("object-contain", className)}
      style={{
        ...(size ? { width: size, height: size } : {}),
        // Remove white background by making it transparent
        mixBlendMode: 'multiply',
        backgroundColor: 'transparent',
      }}
    />
  );
};
