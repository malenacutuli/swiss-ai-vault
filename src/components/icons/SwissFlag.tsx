import { cn } from "@/lib/utils";
import swissVaultLogo from "@/assets/swissvault-logo-transparent.png";

interface SwissFlagProps {
  className?: string;
}

export const SwissFlag = ({ className }: SwissFlagProps) => {
  return (
    <img
      src={swissVaultLogo}
      alt="SwissVault.ai"
      className={cn("object-contain", className)}
    />
  );
};
