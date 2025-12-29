import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "@/icons";

interface InsufficientCreditsModalProps {
  open: boolean;
  onClose: () => void;
  currentBalance?: number;
  requiredAmount?: number;
}

export function InsufficientCreditsModal({
  open,
  onClose,
  currentBalance,
  requiredAmount,
}: InsufficientCreditsModalProps) {
  const navigate = useNavigate();

  const handleAddCredits = () => {
    onClose();
    navigate("/dashboard/billing");
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="bg-card border-border sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/20">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <DialogTitle className="text-foreground">Insufficient Credits</DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground pt-2">
            You don't have enough credits to complete this operation.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-3">
          {currentBalance !== undefined && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Current balance:</span>
              <span className="text-foreground font-medium">${currentBalance.toFixed(2)}</span>
            </div>
          )}
          {requiredAmount !== undefined && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Required amount:</span>
              <span className="text-destructive font-medium">${requiredAmount.toFixed(2)}</span>
            </div>
          )}
          {currentBalance !== undefined && requiredAmount !== undefined && (
            <div className="flex justify-between items-center text-sm pt-2 border-t border-border">
              <span className="text-muted-foreground">Shortfall:</span>
              <span className="text-destructive font-medium">
                ${(requiredAmount - currentBalance).toFixed(2)}
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAddCredits} className="bg-primary hover:bg-primary/90">
            Add Credits
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
