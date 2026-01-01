/**
 * VaultUnlockDialog Component
 * Dialog for unlocking the encrypted vault with password.
 */

import { useState } from 'react';
import { Lock, Eye, EyeOff, Loader2 } from '@/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useEncryptionContext } from '@/contexts/EncryptionContext';

interface VaultUnlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnlocked?: () => void;
}

export function VaultUnlockDialog({ open, onOpenChange, onUnlocked }: VaultUnlockDialogProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  
  const { unlockVault } = useEncryptionContext();
  
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password) {
      setError('Please enter your password');
      return;
    }
    
    setIsUnlocking(true);
    setError('');
    
    try {
      const success = await unlockVault(password);
      
      if (success) {
        setPassword('');
        onOpenChange(false);
        onUnlocked?.();
      } else {
        setError('Incorrect password. Please try again.');
      }
    } catch (err) {
      setError('Failed to unlock vault');
    } finally {
      setIsUnlocking(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Unlock Your Vault</DialogTitle>
              <DialogDescription>
                Enter your encryption password to access your secure messages
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <form onSubmit={handleUnlock} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="password">Encryption Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="Enter your password"
                autoFocus
                disabled={isUnlocking}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={isUnlocking}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="flex-1"
              disabled={isUnlocking || !password}
            >
              {isUnlocking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Unlocking...
                </>
              ) : (
                'Unlock Vault'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
