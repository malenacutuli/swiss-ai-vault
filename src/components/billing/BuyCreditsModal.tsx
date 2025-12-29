import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useGhostCredits } from "@/hooks/useGhostCredits";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Coins, Cpu, Check, Sparkles } from "@/icons";
import { cn } from "@/lib/utils";

interface BuyCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "usage" | "training";
  showTrainingTab?: boolean;
}

interface CreditPackage {
  id: string;
  amount: number;
  description: string;
  popular?: boolean;
}

const USAGE_PACKAGES: CreditPackage[] = [
  { id: "usage_5", amount: 5, description: "Good for ~500 messages" },
  { id: "usage_20", amount: 20, description: "Good for ~2,000 messages", popular: true },
  { id: "usage_50", amount: 50, description: "Good for ~5,000 messages" },
  { id: "usage_100", amount: 100, description: "Good for ~10,000 messages" },
];

const TRAINING_PACKAGES: CreditPackage[] = [
  { id: "training_10", amount: 10, description: "~12 GPU hours" },
  { id: "training_25", amount: 25, description: "~31 GPU hours", popular: true },
  { id: "training_50", amount: 50, description: "~62 GPU hours" },
  { id: "training_100", amount: 100, description: "~125 GPU hours" },
];

export function BuyCreditsModal({ 
  open, 
  onOpenChange, 
  defaultTab = "usage",
  showTrainingTab = false 
}: BuyCreditsModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { balance } = useGhostCredits();
  
  const [activeTab, setActiveTab] = useState<"usage" | "training">(defaultTab);
  const [selectedUsage, setSelectedUsage] = useState<string>("usage_20");
  const [selectedTraining, setSelectedTraining] = useState<string>("training_25");
  const [isLoading, setIsLoading] = useState(false);

  const currentBalance = balance / 100; // Convert to dollars
  const trainingBalance = 38.50; // Mock - would come from billing status
  const monthlyTrainingAllowance = 50; // Mock - from subscription

  const handlePurchase = async (type: "usage" | "training", packageId: string) => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to purchase credits",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const packages = type === "usage" ? USAGE_PACKAGES : TRAINING_PACKAGES;
      const selectedPackage = packages.find(p => p.id === packageId);
      
      if (!selectedPackage) throw new Error("Package not found");

      const { data, error } = await supabase.functions.invoke("create-credits-checkout", {
        body: { 
          type,
          amount: selectedPackage.amount,
          packageId: selectedPackage.id,
        },
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

  const RadioOption = ({ 
    pkg, 
    selected, 
    onSelect 
  }: { 
    pkg: CreditPackage; 
    selected: boolean; 
    onSelect: () => void;
  }) => (
    <button
      onClick={onSelect}
      className={cn(
        "relative w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left",
        "hover:border-primary/50 hover:bg-secondary/30",
        selected 
          ? "border-primary bg-primary/5" 
          : "border-border bg-card"
      )}
    >
      {/* Custom Radio */}
      <div className={cn(
        "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
        selected ? "border-primary bg-primary" : "border-muted-foreground/40"
      )}>
        {selected && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold font-mono text-foreground">
            ${pkg.amount}
          </span>
          {pkg.popular && (
            <span className="px-2 py-0.5 text-xs font-medium uppercase tracking-wider bg-primary text-primary-foreground rounded">
              Best Value
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          {pkg.description}
        </p>
      </div>

      {/* Check icon for selected */}
      {selected && (
        <Check className="h-5 w-5 text-primary shrink-0" />
      )}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground font-serif text-xl">
            <Coins className="h-5 w-5 text-primary" />
            Purchase Credits
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Add credits to your account for AI services
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "usage" | "training")}>
          <TabsList className={cn(
            "grid w-full",
            showTrainingTab ? "grid-cols-2" : "grid-cols-1"
          )}>
            <TabsTrigger value="usage" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Usage Credits
            </TabsTrigger>
            {showTrainingTab && (
              <TabsTrigger value="training" className="flex items-center gap-2">
                <Cpu className="h-4 w-4" />
                Training Credits
              </TabsTrigger>
            )}
          </TabsList>

          {/* Usage Credits Tab */}
          <TabsContent value="usage" className="mt-4 space-y-4">
            <div className="space-y-2">
              {USAGE_PACKAGES.map((pkg) => (
                <RadioOption
                  key={pkg.id}
                  pkg={pkg}
                  selected={selectedUsage === pkg.id}
                  onSelect={() => setSelectedUsage(pkg.id)}
                />
              ))}
            </div>

            {/* Current Balance */}
            <div className="pt-3 border-t border-border">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current balance</span>
                <span className="font-mono font-medium text-foreground">
                  ${currentBalance.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => handlePurchase("usage", selectedUsage)}
                disabled={isLoading}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                {isLoading ? "Processing..." : "Purchase with Card"}
              </Button>
            </div>
          </TabsContent>

          {/* Training Credits Tab */}
          {showTrainingTab && (
            <TabsContent value="training" className="mt-4 space-y-4">
              <div className="space-y-2">
                {TRAINING_PACKAGES.map((pkg) => (
                  <RadioOption
                    key={pkg.id}
                    pkg={pkg}
                    selected={selectedTraining === pkg.id}
                    onSelect={() => setSelectedTraining(pkg.id)}
                  />
                ))}
              </div>

              {/* Current Balance & Subscription */}
              <div className="pt-3 border-t border-border space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Current balance</span>
                  <span className="font-mono font-medium text-foreground">
                    ${trainingBalance.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Monthly from subscription</span>
                  <span className="font-mono font-medium text-muted-foreground">
                    ${monthlyTrainingAllowance}
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <Button
                  onClick={() => handlePurchase("training", selectedTraining)}
                  disabled={isLoading}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  {isLoading ? "Processing..." : "Purchase with Card"}
                </Button>
              </div>
            </TabsContent>
          )}
        </Tabs>

        {/* Features */}
        <div className="pt-4 border-t border-border">
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-primary" />
              Credits never expire
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-primary" />
              Instant activation
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-primary" />
              Swiss-hosted only
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-primary" />
              Zero data logging
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
