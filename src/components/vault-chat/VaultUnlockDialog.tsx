/**
 * VaultUnlockDialog Component
 * Dialog for unlocking or setting up the encrypted vault with password.
 * Handles both first-time setup and returning user unlock flows.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Eye, EyeOff, Loader2, Shield, AlertTriangle, ArrowRight, ArrowLeft } from '@/icons';
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
import { useEncryptionContext } from '@/contexts/EncryptionContext';

interface VaultUnlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnlocked?: () => void;
}

export function VaultUnlockDialog({ open, onOpenChange, onUnlocked }: VaultUnlockDialogProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [setupStep, setSetupStep] = useState<'password' | 'confirm'>('password');
  
  const { unlockVault, setupEncryption, clearVault, isInitialized } = useEncryptionContext();
  
  // Password strength for setup mode
  const passwordStrength = getPasswordStrength(password);
  
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password) {
      setError(t('vault.unlock.enterPassword', 'Please enter your password'));
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
        setError(t('vault.unlock.incorrectPassword', 'Incorrect password. Please try again.'));
      }
    } catch (err) {
      setError(t('vault.unlock.failed', 'Failed to unlock vault'));
    } finally {
      setIsUnlocking(false);
    }
  };
  
  const handleSetup = async () => {
    if (password !== confirmPassword) {
      setError(t('vault.setup.mismatch', 'Passwords do not match'));
      return;
    }
    
    if (passwordStrength.score < 2) {
      setError(t('vault.setup.tooWeak', 'Password is too weak'));
      return;
    }
    
    setIsUnlocking(true);
    setError('');
    
    try {
      const success = await setupEncryption(password);
      
      if (success) {
        setPassword('');
        setConfirmPassword('');
        setSetupStep('password');
        onOpenChange(false);
        onUnlocked?.();
      } else {
        setError(t('vault.setup.failed', 'Setup failed. Please try again.'));
      }
    } catch (err) {
      setError(t('vault.setup.failed', 'Setup failed. Please try again.'));
    } finally {
      setIsUnlocking(false);
    }
  };
  
  const handleResetVault = async () => {
    try {
      await clearVault();
      setShowResetConfirm(false);
      setPassword('');
      setConfirmPassword('');
      setError('');
      setSetupStep('password');
      // Keep dialog open so user can set up new vault
    } catch (err) {
      setError(t('vault.reset.failed', 'Failed to reset vault'));
    }
  };
  
  const handleClose = () => {
    setPassword('');
    setConfirmPassword('');
    setError('');
    setSetupStep('password');
    onOpenChange(false);
  };
  
  // Setup mode - vault not initialized
  if (!isInitialized) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle>{t('vault.setup.title', 'Set Up Personal Memory')}</DialogTitle>
                <DialogDescription>
                  {t('vault.setup.description', 'Create an encryption password to securely store your AI memory')}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          {setupStep === 'password' ? (
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="setup-password">{t('vault.setup.passwordLabel', 'Create Password')}</Label>
                <div className="relative">
                  <Input
                    id="setup-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                    }}
                    placeholder={t('vault.setup.passwordPlaceholder', 'Enter a strong password')}
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
                <PasswordStrengthIndicator strength={passwordStrength} />
              </div>
              
              <ul className="text-xs text-muted-foreground space-y-1">
                <li className={password.length >= 8 ? 'text-green-600 dark:text-green-400' : ''}>
                  • {t('vault.setup.req8chars', 'At least 8 characters')}
                </li>
                <li className={/[A-Z]/.test(password) ? 'text-green-600 dark:text-green-400' : ''}>
                  • {t('vault.setup.reqUppercase', 'One uppercase letter')}
                </li>
                <li className={/[0-9]/.test(password) ? 'text-green-600 dark:text-green-400' : ''}>
                  • {t('vault.setup.reqNumber', 'One number')}
                </li>
              </ul>
              
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1"
                >
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button 
                  onClick={() => setSetupStep('confirm')}
                  className="flex-1"
                  disabled={passwordStrength.score < 2}
                >
                  {t('common.continue', 'Continue')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="confirm-password">{t('vault.setup.confirmLabel', 'Confirm Password')}</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setError('');
                    }}
                    placeholder={t('vault.setup.confirmPlaceholder', 'Re-enter your password')}
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
              </div>
              
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  {t('vault.setup.warning', 'Remember this password! If you forget it, you will lose access to your encrypted memory.')}
                </p>
              </div>
              
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSetupStep('password')}
                  disabled={isUnlocking}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t('common.back', 'Back')}
                </Button>
                <Button 
                  onClick={handleSetup}
                  className="flex-1"
                  disabled={isUnlocking || !confirmPassword}
                >
                  {isUnlocking ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('vault.setup.settingUp', 'Setting up...')}
                    </>
                  ) : (
                    t('vault.setup.enable', 'Enable Memory')
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }
  
  // Unlock mode - vault is initialized but locked
  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle>{t('vault.unlock.title', 'Unlock Your Memory')}</DialogTitle>
                <DialogDescription>
                  {t('vault.unlock.description', 'Enter your encryption password to access your AI memory')}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <form onSubmit={handleUnlock} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="password">{t('vault.unlock.passwordLabel', 'Encryption Password')}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder={t('vault.unlock.passwordPlaceholder', 'Enter your password')}
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
                onClick={handleClose}
                className="flex-1"
                disabled={isUnlocking}
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button 
                type="submit" 
                className="flex-1"
                disabled={isUnlocking || !password}
              >
                {isUnlocking ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('vault.unlock.unlocking', 'Unlocking...')}
                  </>
                ) : (
                  t('vault.unlock.submit', 'Unlock')
                )}
              </Button>
            </div>
            
            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('vault.unlock.forgotPassword', 'Forgot password? Reset vault')}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('vault.reset.title', 'Reset Encryption Vault?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('vault.reset.warning', 'This will permanently delete all your encrypted memory data. This action cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetVault}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('vault.reset.confirm', 'Reset Vault')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function PasswordStrengthIndicator({ strength }: { strength: { score: number; label: string; color: string } }) {
  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= strength.score ? strength.color : 'bg-muted'
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{strength.label}</p>
    </div>
  );
}

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  
  score = Math.min(4, score);
  
  const labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-green-600'];
  
  return {
    score,
    label: labels[score],
    color: colors[score]
  };
}
