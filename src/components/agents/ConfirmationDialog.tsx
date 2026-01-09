import { useState, useEffect } from 'react';
import { AlertTriangle, Shield, X, Check, Clock } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onDeny: () => void;
  toolName: string;
  params: unknown;
  riskLevel: 'moderate' | 'high' | 'critical';
  reason?: string;
  timeoutMs?: number;
}

export function ConfirmationDialog({
  isOpen,
  onConfirm,
  onDeny,
  toolName,
  params,
  riskLevel,
  reason,
  timeoutMs = 30000,
}: ConfirmationDialogProps) {
  const [timeRemaining, setTimeRemaining] = useState(timeoutMs / 1000);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!isOpen) {
      setTimeRemaining(timeoutMs / 1000);
      setProgress(100);
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        const next = prev - 0.1;
        if (next <= 0) {
          clearInterval(interval);
          onDeny();
          return 0;
        }
        return next;
      });
      setProgress(prev => {
        const decrement = (100 / (timeoutMs / 100));
        return Math.max(0, prev - decrement);
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isOpen, timeoutMs, onDeny]);

  const getRiskColor = () => {
    switch (riskLevel) {
      case 'critical':
        return 'text-destructive border-destructive';
      case 'high':
        return 'text-orange-500 border-orange-500';
      case 'moderate':
        return 'text-yellow-500 border-yellow-500';
      default:
        return 'text-muted-foreground border-border';
    }
  };

  const getRiskIcon = () => {
    switch (riskLevel) {
      case 'critical':
        return <AlertTriangle className="h-6 w-6 text-destructive" />;
      case 'high':
        return <AlertTriangle className="h-6 w-6 text-orange-500" />;
      case 'moderate':
        return <Shield className="h-6 w-6 text-yellow-500" />;
      default:
        return <Shield className="h-6 w-6" />;
    }
  };

  const formatParams = (params: unknown): string => {
    try {
      return JSON.stringify(params, null, 2);
    } catch {
      return String(params);
    }
  };

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            {getRiskIcon()}
            <AlertDialogTitle className={cn("text-lg", getRiskColor())}>
              Confirm {riskLevel === 'critical' ? 'Critical' : riskLevel === 'high' ? 'Dangerous' : 'Sensitive'} Operation
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {reason || `The agent wants to execute a ${riskLevel} risk operation that requires your approval.`}
              </p>

              <div className={cn("rounded-lg border p-3", getRiskColor())}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium uppercase tracking-wide opacity-70">Tool</span>
                  <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
                    {toolName}
                  </code>
                </div>
                
                <div className="text-xs font-medium uppercase tracking-wide opacity-70 mb-1">
                  Parameters
                </div>
                <ScrollArea className="h-32 rounded bg-muted/50">
                  <pre className="text-xs p-2 font-mono whitespace-pre-wrap break-all">
                    {formatParams(params)}
                  </pre>
                </ScrollArea>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Auto-deny in {Math.ceil(timeRemaining)}s</span>
              </div>
              <Progress value={progress} className="h-1" />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel asChild>
            <Button
              variant="outline"
              onClick={onDeny}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Deny
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              onClick={onConfirm}
              variant={riskLevel === 'critical' ? 'destructive' : 'default'}
              className="gap-2"
            >
              <Check className="h-4 w-4" />
              Confirm & Execute
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
