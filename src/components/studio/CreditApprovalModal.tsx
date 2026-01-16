import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Coins, AlertTriangle, Loader2, Video, Image, Clock, Monitor } from 'lucide-react';
import { calculateCreditCost } from '@/lib/creditPricing';
import { useCredits } from '@/hooks/useCredits';

interface CreditApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  artifactType: string;
  options: {
    duration?: number;
    pageCount?: number;
    resolution?: string;
    detailLevel?: string;
  };
  title: string;
  loading?: boolean;
}

const ARTIFACT_ICONS: Record<string, React.ReactNode> = {
  video_summary: <Video className="w-6 h-6" />,
  infographic: <Image className="w-6 h-6" />,
};

export function CreditApprovalModal({
  isOpen,
  onClose,
  onConfirm,
  artifactType,
  options,
  title,
  loading = false
}: CreditApprovalModalProps) {
  const { credits } = useCredits();
  const balance = credits.totalAvailable;
  
  const cost = useMemo(() => {
    return calculateCreditCost(artifactType, options);
  }, [artifactType, options]);
  
  const canAfford = balance >= cost;
  const shortfall = cost - balance;

  const formatArtifactType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-500" />
            Confirm Generation
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Artifact preview */}
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              {ARTIFACT_ICONS[artifactType] || <Monitor className="w-6 h-6" />}
            </div>
            <div>
              <p className="font-medium">{title}</p>
              <p className="text-sm text-muted-foreground">{formatArtifactType(artifactType)}</p>
            </div>
          </div>

          {/* Parameters */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {options.duration && (
              <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  Duration
                </span>
                <span className="font-medium">{options.duration}s</span>
              </div>
            )}
            
            {options.resolution && (
              <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Monitor className="w-3.5 h-3.5" />
                  Resolution
                </span>
                <span className="font-medium">{options.resolution}</span>
              </div>
            )}
            
            {options.detailLevel && (
              <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                <span className="text-muted-foreground">Detail Level</span>
                <span className="font-medium capitalize">{options.detailLevel}</span>
              </div>
            )}
          </div>

          {/* Cost summary */}
          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-amber-900 dark:text-amber-100 font-medium">Estimated Cost</span>
              <span className="text-xl font-bold text-amber-600">{cost} Credits</span>
            </div>
          </div>

          {/* Balance */}
          <div className="flex items-center justify-between px-1">
            <span className="text-muted-foreground">Your Balance</span>
            <span className={`font-semibold ${canAfford ? 'text-green-600' : 'text-red-500'}`}>
              {balance} Credits
            </span>
          </div>

          {/* Insufficient funds warning */}
          {!canAfford && (
            <div className="flex gap-3 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-900 dark:text-red-100">Insufficient credits</p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-0.5">
                  You need {shortfall} more credits.
                </p>
                <Button variant="link" className="h-auto p-0 text-red-600 mt-1">
                  Upgrade to Pro for more credits →
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={onConfirm} 
            disabled={!canAfford || loading}
            className="bg-primary"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Coins className="w-4 h-4 mr-2" />
                Confirm ({cost} cr)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
