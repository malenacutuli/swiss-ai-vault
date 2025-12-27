import { cn } from "@/lib/utils";
import swissVaultLogo from "@/assets/swissvault-logo.png";

interface SwissFlagProps {
  className?: string;
}

export const SwissFlag = ({ className }: SwissFlagProps) => {
  return (
    <img
      src={swissVaultLogo}
      alt="SwissVault Logo"
      className={cn("rounded", className)}
    />
  );
};
