import { ReactNode } from "react";
import { useProductAccess } from "@/hooks/useProductAccess";
import { UpgradePrompt } from "./UpgradePrompt";
import { Skeleton } from "@/components/ui/skeleton";

interface VaultLabGateProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export const VaultLabGate = ({ children, fallback }: VaultLabGateProps) => {
  const { canAccessVaultLab, isLoading } = useProductAccess();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Skeleton className="w-full max-w-md h-[400px] rounded-2xl" />
      </div>
    );
  }

  if (!canAccessVaultLab) {
    return (
      fallback ?? (
        <UpgradePrompt
          title="Vault Lab requires Team"
          description="Fine-tune private LLMs on your confidential data with Swiss privacy."
          features={[
            "Custom model fine-tuning",
            "Private dataset management",
            "Model evaluation & benchmarks",
            "Dedicated GPU training credits",
            "$50/month training credits included",
            "Priority support & SLA",
          ]}
          targetTier="team"
          price="$200/month"
        />
      )
    );
  }

  return <>{children}</>;
};
