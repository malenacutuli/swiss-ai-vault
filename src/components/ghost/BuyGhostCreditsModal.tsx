import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Coins, Zap, Shield, Check } from "@/icons";
import { cn } from "@/lib/utils";

interface BuyGhostCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PACKAGES = [
  { credits: 10000, price: 5, label: "10K", popular: false },
  { credits: 50000, price: 20, label: "50K", popular: true },
  { credits: 200000, price: 60, label: "200K", popular: false },
  { credits: 1000000, price: 200, label: "1M", popular: false },
];

export function BuyGhostCreditsModal({ open, onOpenChange }: BuyGhostCreditsModalProps) {
  const { toast } = useToast();
  const [selectedPackage, setSelectedPackage] = useState(PACKAGES[1]);
  const [isLoading, setIsLoading] = useState(false);

  const handlePurchase = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-ghost-credits-checkout", {
        body: { credits: selectedPackage.credits },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.url) {
        window.open(data.url, "_blank");
        onOpenChange(false);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: (error as Error).message || "Failed to create checkout session",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-slate-900 border-purple-500/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Coins className="h-5 w-5 text-purple-400" />
            Buy Ghost Tokens
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Top up your Ghost Mode tokens for Swiss-hosted AI inference
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 my-4">
          {PACKAGES.map((pkg) => (
            <button
              key={pkg.credits}
              onClick={() => setSelectedPackage(pkg)}
              className={cn(
                "relative p-4 rounded-lg border-2 transition-all text-left",
                selectedPackage.credits === pkg.credits
                  ? "border-purple-500 bg-purple-500/20"
                  : "border-purple-500/30 hover:border-purple-500/50 bg-slate-800/50"
              )}
            >
              {pkg.popular && (
                <span className="absolute -top-2 right-2 px-2 py-0.5 text-xs font-medium bg-purple-600 text-white rounded-full">
                  Popular
                </span>
              )}
              <p className="text-2xl font-bold text-white">{pkg.label}</p>
              <p className="text-sm text-muted-foreground">tokens</p>
              <p className="mt-2 text-lg font-semibold text-purple-400">${pkg.price}</p>
            </button>
          ))}
        </div>

        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-500" />
            <span>Swiss-hosted AI models only</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-green-500" />
            <span>Zero content logging</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-green-500" />
            <span>Tokens never expire</span>
          </div>
        </div>

        <Button
          onClick={handlePurchase}
          disabled={isLoading}
          className="w-full mt-4 bg-purple-600 hover:bg-purple-700 text-white"
        >
          {isLoading ? "Processing..." : `Buy ${selectedPackage.label} Tokens for $${selectedPackage.price}`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
