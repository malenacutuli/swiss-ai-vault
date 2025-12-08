import { useState } from 'react';
import { Shield, ShieldCheck, Key, Lock, Eye, EyeOff, Copy, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

interface EncryptionStatusProps {
  conversationId: string | null;
  isEncrypted: boolean;
  keyHash?: string;
  onExportKey?: () => void;
}

export function EncryptionStatus({ 
  conversationId, 
  isEncrypted, 
  keyHash,
  onExportKey 
}: EncryptionStatusProps) {
  const [showKeyDetails, setShowKeyDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Truncate key hash for display
  const displayHash = keyHash 
    ? `${keyHash.slice(0, 8)}...${keyHash.slice(-8)}`
    : 'Not available';
  
  const copyKeyHash = () => {
    if (keyHash) {
      navigator.clipboard.writeText(keyHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  if (!conversationId) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <Shield className="h-3 w-3" />
        No conversation
      </Badge>
    );
  }
  
  return (
    <Dialog>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="gap-1.5 h-7 px-2"
              >
                {isEncrypted ? (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
                    <span className="text-xs text-green-600 font-medium">E2E Encrypted</span>
                  </>
                ) : (
                  <>
                    <Shield className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs text-amber-500">Unencrypted</span>
                  </>
                )}
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Click to view encryption details</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-600" />
            Encryption Details
          </DialogTitle>
          <DialogDescription>
            Your conversation is protected with AES-256-GCM encryption
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Encryption Status */}
          <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">End-to-End Encrypted</span>
            </div>
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          </div>
          
          {/* Key Fingerprint */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Key Fingerprint
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 bg-muted rounded text-xs font-mono">
                {showKeyDetails ? keyHash : displayHash}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowKeyDetails(!showKeyDetails)}
              >
                {showKeyDetails ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={copyKeyHash}
              >
                {copied ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Compare this fingerprint on another device to verify encryption
            </p>
          </div>
          
          {/* Security Info */}
          <div className="space-y-2 pt-2 border-t">
            <h4 className="text-sm font-medium">Security Details</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-muted rounded">
                <span className="text-muted-foreground">Algorithm</span>
                <p className="font-medium">AES-256-GCM</p>
              </div>
              <div className="p-2 bg-muted rounded">
                <span className="text-muted-foreground">Key Size</span>
                <p className="font-medium">256 bits</p>
              </div>
              <div className="p-2 bg-muted rounded">
                <span className="text-muted-foreground">Mode</span>
                <p className="font-medium">Zero-Knowledge</p>
              </div>
              <div className="p-2 bg-muted rounded">
                <span className="text-muted-foreground">Storage</span>
                <p className="font-medium">Client-Side Only</p>
              </div>
            </div>
          </div>
          
          {/* What This Means */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
              What this means
            </h4>
            <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <li>• Your messages are encrypted before leaving your device</li>
              <li>• SwissVault cannot read your conversation content</li>
              <li>• Only you have access to the decryption key</li>
              <li>• Even with a data breach, your messages stay private</li>
            </ul>
          </div>
          
          {/* Export Button */}
          {onExportKey && (
            <Button 
              variant="outline" 
              className="w-full gap-2"
              onClick={onExportKey}
            >
              <Key className="h-4 w-4" />
              Export Encryption Key
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
