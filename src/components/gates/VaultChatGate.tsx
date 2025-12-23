import { ReactNode } from "react";
import { useProductAccess } from "@/hooks/useProductAccess";
import { UpgradePrompt } from "./UpgradePrompt";
import { Skeleton } from "@/components/ui/skeleton";

interface VaultChatGateProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export const VaultChatGate = ({ children, fallback }: VaultChatGateProps) => {
  const { canAccessVaultChat, isLoading } = useProductAccess();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Skeleton className="w-full max-w-md h-[400px] rounded-2xl" />
      </div>
    );
  }

  if (!canAccessVaultChat) {
    return (
      fallback ?? (
        <UpgradePrompt
          title="Vault Chat requires Pro"
          description="Unlock end-to-end encrypted chat with document intelligence."
          features={[
            "Upload and search documents with RAG",
            "End-to-end encryption (E2EE)",
            "Encrypted document storage",
            "Deep Research with 50 queries/month",
            "Connect to Notion, Slack, Google Drive",
          ]}
          targetTier="pro"
          price="$19/month"
        />
      )
    );
  }

  return <>{children}</>;
};
