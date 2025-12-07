/**
 * EncryptionSetupWizard Component
 * Multi-step wizard for first-time encryption setup.
 * Guides users through password creation with strength indicators.
 */

import { useState } from 'react';
import { Shield, Lock, Key, CheckCircle, AlertTriangle, ArrowRight, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEncryption } from '@/hooks/useEncryption';

interface EncryptionSetupWizardProps {
  onComplete: () => void;
  onSkip?: () => void;
}

type Step = 'intro' | 'password' | 'confirm' | 'complete';

export function EncryptionSetupWizard({ onComplete, onSkip }: EncryptionSetupWizardProps) {
  const [step, setStep] = useState<Step>('intro');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSettingUp, setIsSettingUp] = useState(false);
  
  const { setupEncryption } = useEncryption();
  
  const passwordStrength = getPasswordStrength(password);
  
  const handleSetup = async () => {
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setIsSettingUp(true);
    setError('');
    
    try {
      const success = await setupEncryption(password);
      if (success) {
        setStep('complete');
      } else {
        setError('Setup failed. Please try again.');
      }
    } catch (e) {
      setError('An error occurred during setup');
    } finally {
      setIsSettingUp(false);
    }
  };
  
  return (
    <Card className="max-w-lg mx-auto border-border/50 shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle>End-to-End Encryption</CardTitle>
            <CardDescription>
              Protect your AI conversations with military-grade encryption
            </CardDescription>
          </div>
        </div>
        <Progress 
          value={
            step === 'intro' ? 25 : 
            step === 'password' ? 50 : 
            step === 'confirm' ? 75 : 100
          } 
          className="mt-4"
        />
      </CardHeader>
      
      <CardContent>
        {step === 'intro' && (
          <div className="space-y-6">
            <div className="space-y-4">
              <Feature 
                icon={Lock} 
                title="Zero-Knowledge Security"
                description="Your messages are encrypted before leaving your device. Not even SwissVault can read them."
              />
              <Feature 
                icon={Key} 
                title="You Control the Keys"
                description="Your encryption key is derived from your password and never sent to our servers."
              />
              <Feature 
                icon={Shield} 
                title="Swiss Data Sovereignty"
                description="All encrypted data stored in Switzerland under strict privacy laws."
              />
            </div>
            
            <div className="flex gap-3">
              {onSkip && (
                <Button variant="outline" onClick={onSkip} className="flex-1">
                  Skip for now
                </Button>
              )}
              <Button onClick={() => setStep('password')} className="flex-1">
                Set Up Encryption
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        
        {step === 'password' && (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Create Encryption Password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter a strong password"
                    className="pr-10"
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <PasswordStrengthIndicator strength={passwordStrength} />
              </div>
              
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className={password.length >= 8 ? 'text-green-600 dark:text-green-400' : ''}>
                  • At least 8 characters
                </li>
                <li className={/[A-Z]/.test(password) ? 'text-green-600 dark:text-green-400' : ''}>
                  • One uppercase letter
                </li>
                <li className={/[0-9]/.test(password) ? 'text-green-600 dark:text-green-400' : ''}>
                  • One number
                </li>
                <li className={/[^A-Za-z0-9]/.test(password) ? 'text-green-600 dark:text-green-400' : ''}>
                  • One special character
                </li>
              </ul>
            </div>
            
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('intro')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button 
                onClick={() => setStep('confirm')} 
                disabled={passwordStrength.score < 2}
                className="flex-1"
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        
        {step === 'confirm' && (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Confirm Password</label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setError('');
                    }}
                    placeholder="Re-enter your password"
                    className="pr-10"
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
              
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-medium">Remember this password!</p>
                  <p className="mt-1">
                    If you forget this password, you will permanently lose access 
                    to all encrypted messages. We cannot recover it for you.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('password')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button 
                onClick={handleSetup} 
                disabled={isSettingUp || !confirmPassword}
                className="flex-1"
              >
                {isSettingUp ? 'Setting up...' : 'Enable Encryption'}
              </Button>
            </div>
          </div>
        )}
        
        {step === 'complete' && (
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/20">
                <CheckCircle className="h-12 w-12 text-green-600" />
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold">Encryption Enabled!</h3>
              <p className="text-muted-foreground mt-1">
                Your messages are now protected with end-to-end encryption.
              </p>
            </div>
            
            <Button onClick={onComplete} className="w-full">
              Start Secure Chat
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Feature({ icon: Icon, title, description }: { 
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="p-2 rounded-lg bg-muted shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium text-sm">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
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
