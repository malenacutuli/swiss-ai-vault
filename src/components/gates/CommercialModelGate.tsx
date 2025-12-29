import { ReactNode, useState } from "react";
import { Lock } from "@/icons";
import { Link } from "react-router-dom";
import { useProductAccess } from "@/hooks/useProductAccess";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface CommercialModelGateProps {
  modelName: string;
  children: ReactNode;
  className?: string;
}

/**
 * Wraps a model option to show a lock and upgrade prompt for commercial models
 * when the user doesn't have Pro access.
 */
export const CommercialModelGate = ({
  modelName,
  children,
  className,
}: CommercialModelGateProps) => {
  const { canUseCommercialModels } = useProductAccess();
  const [showUpgrade, setShowUpgrade] = useState(false);

  if (canUseCommercialModels) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        onClick={() => setShowUpgrade(true)}
        className={cn(
          "relative cursor-pointer opacity-60 hover:opacity-80 transition-opacity",
          className
        )}
      >
        {children}
        <div className="absolute inset-0 flex items-center justify-end pr-3 pointer-events-none">
          <Lock className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>

      <Dialog open={showUpgrade} onOpenChange={setShowUpgrade}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              {modelName} requires Pro
            </DialogTitle>
            <DialogDescription>
              Commercial models like {modelName} are available with a Pro
              subscription. Upgrade to access GPT-4o, Claude, and other premium
              models.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
              <h4 className="font-medium mb-2">Pro includes:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Access to GPT-4o, Claude Opus, Gemini Pro</li>
                <li>• Vault Chat with E2EE</li>
                <li>• $20/month in API credits</li>
                <li>• Deep Research (50 queries/mo)</li>
              </ul>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowUpgrade(false)}>
              Use Free Models
            </Button>
            <Button asChild>
              <Link to="/labs/billing">Upgrade to Pro</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

/**
 * Lock icon overlay for model selectors
 */
export const ModelLockIcon = ({ className }: { className?: string }) => {
  return (
    <div
      className={cn(
        "flex items-center justify-center w-5 h-5 rounded-full bg-muted/80",
        className
      )}
    >
      <Lock className="w-3 h-3 text-muted-foreground" />
    </div>
  );
};

/**
 * Hook to check if a model is accessible
 */
export const useModelAccess = (modelId: string, isCommercial: boolean) => {
  const { canUseCommercialModels } = useProductAccess();
  
  return {
    canAccess: !isCommercial || canUseCommercialModels,
    isLocked: isCommercial && !canUseCommercialModels,
  };
};
