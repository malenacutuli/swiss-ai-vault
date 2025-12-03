import { cn } from "@/lib/utils";

interface SwissFlagProps {
  className?: string;
}

export const SwissFlag = ({ className }: SwissFlagProps) => {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("", className)}
    >
      <rect width="32" height="32" rx="4" className="fill-primary" />
      <path
        d="M14 8H18V14H24V18H18V24H14V18H8V14H14V8Z"
        className="fill-primary-foreground"
      />
    </svg>
  );
};
