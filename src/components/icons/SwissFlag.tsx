import { cn } from "@/lib/utils";
import swissFlagImage from "@/assets/swiss-flag.png";

interface SwissFlagProps {
  className?: string;
}

export const SwissFlag = ({ className }: SwissFlagProps) => {
  return (
    <img
      src={swissFlagImage}
      alt="Swiss Flag"
      className={cn("rounded", className)}
    />
  );
};
