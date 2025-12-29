/**
 * Security Badge Components
 * Visual indicators for encryption status, zero-retention mode, and Swiss hosting.
 */

import { Shield, Lock, EyeOff, Loader2, CheckCircle } from '@/icons';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface SecurityBadgesProps {
  isEncrypted?: boolean;
  zeroRetention?: boolean;
  showSwissHosted?: boolean;
  className?: string;
}

export function SecurityBadges({ 
  isEncrypted = true, 
  zeroRetention = false,
  showSwissHosted = true,
  className 
}: SecurityBadgesProps) {
  return (
    <TooltipProvider>
      <div className={cn("flex flex-wrap gap-2 items-center", className)}>
        {isEncrypted && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant="secondary" 
                className="gap-1.5 text-xs bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800 cursor-help"
              >
                <Lock className="h-3 w-3" />
                E2E Encrypted
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="font-medium">End-to-End Encryption</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your messages are encrypted with AES-256-GCM before leaving your device. 
                Only you can read them - not even SwissVault has access.
              </p>
            </TooltipContent>
          </Tooltip>
        )}
        
        {zeroRetention && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant="secondary" 
                className="gap-1.5 text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800 cursor-help"
              >
                <EyeOff className="h-3 w-3" />
                Zero Retention
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="font-medium">Zero Data Retention</p>
              <p className="text-xs text-muted-foreground mt-1">
                This conversation is not logged or stored on our servers. 
                AI responses are generated and immediately discarded.
              </p>
            </TooltipContent>
          </Tooltip>
        )}
        
        {showSwissHosted && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant="secondary" 
                className="gap-1.5 text-xs cursor-help"
              >
                <span className="text-sm">🇨🇭</span>
                Swiss Hosted
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="font-medium">Swiss Data Sovereignty</p>
              <p className="text-xs text-muted-foreground mt-1">
                All encrypted data is stored in Switzerland (AWS eu-central-2) 
                under strict Swiss privacy laws.
              </p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

/**
 * Encryption status indicator for message input
 */
interface EncryptionStatusProps {
  isEncrypting: boolean;
  isUnlocked: boolean;
}

export function EncryptionStatus({ isEncrypting, isUnlocked }: EncryptionStatusProps) {
  if (!isUnlocked) {
    return (
      <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
        <Lock className="h-3 w-3" />
        <span>Vault locked</span>
      </div>
    );
  }
  
  if (isEncrypting) {
    return (
      <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 animate-pulse">
        <div className="relative">
          <Lock className="h-3 w-3" />
          <Loader2 className="h-3 w-3 absolute inset-0 animate-spin opacity-50" />
        </div>
        <span>Encrypting...</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
      <CheckCircle className="h-3 w-3" />
      <span>Ready to send securely</span>
    </div>
  );
}

/**
 * Vault status badge for header
 */
interface VaultStatusBadgeProps {
  isUnlocked: boolean;
  onClick?: () => void;
}

export function VaultStatusBadge({ isUnlocked, onClick }: VaultStatusBadgeProps) {
  return (
    <Badge 
      variant={isUnlocked ? "default" : "secondary"}
      className={cn(
        "gap-1.5 cursor-pointer transition-colors",
        isUnlocked 
          ? "bg-green-600 hover:bg-green-700 text-white" 
          : "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400"
      )}
      onClick={onClick}
    >
      {isUnlocked ? (
        <>
          <Shield className="h-3 w-3" />
          Vault Unlocked
        </>
      ) : (
        <>
          <Lock className="h-3 w-3" />
          Vault Locked
        </>
      )}
    </Badge>
  );
}

/**
 * Compact encryption indicator for message bubbles
 */
interface MessageEncryptionIndicatorProps {
  className?: string;
}

export function MessageEncryptionIndicator({ className }: MessageEncryptionIndicatorProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn("inline-flex items-center text-muted-foreground/50 cursor-help", className)}>
          <Lock className="h-2.5 w-2.5" />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs">End-to-end encrypted</p>
      </TooltipContent>
    </Tooltip>
  );
}
