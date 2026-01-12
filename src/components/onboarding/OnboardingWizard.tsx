// src/components/onboarding/OnboardingWizard.tsx
import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, Check, Shield, Sparkles, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useNavigate } from 'react-router-dom';

const STEPS = ['Welcome', 'Profile', 'Privacy', 'First Task'];

export function OnboardingWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [fullName, setFullName] = useState('');
  const [privacyMode, setPrivacyMode] = useState('standard');
  const [isComplete, setIsComplete] = useState(false);
  const { updateProfile, updatePreferences } = useUserSettings();
  const navigate = useNavigate();

  const handleNext = async () => {
    if (currentStep === 1 && fullName) {
      await updateProfile({ full_name: fullName });
    }
    if (currentStep === 2) {
      await updatePreferences({ privacy_mode: privacyMode as any });
    }
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setIsComplete(true);
      // Mark onboarding complete in localStorage
      localStorage.setItem('swissbrain_onboarding_complete', 'true');
      navigate('/agents');
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((step, idx) => (
            <React.Fragment key={step}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  idx < currentStep
                    ? 'bg-[#1D4E5F] text-white'
                    : idx === currentStep
                    ? 'bg-[#1D4E5F] text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {idx < currentStep ? <Check className="w-4 h-4" /> : idx + 1}
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={`w-12 h-1 ${
                    idx < currentStep ? 'bg-[#1D4E5F]' : 'bg-gray-200'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        <Card>
          <CardContent className="p-8">
            {/* Step 0: Welcome */}
            {currentStep === 0 && (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-[#1D4E5F]/10 flex items-center justify-center mx-auto mb-6">
                  <Sparkles className="w-8 h-8 text-[#1D4E5F]" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Welcome to SwissBrain</h1>
                <p className="text-gray-500 mb-6">
                  Your private AI assistant with Swiss data protection.
                  Let's get you set up in just a few steps.
                </p>
                <div className="space-y-3 text-left">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                    <Shield className="w-5 h-5 text-[#1D4E5F]" />
                    <span className="text-sm">Swiss data residency & GDPR compliant</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                    <Sparkles className="w-5 h-5 text-[#1D4E5F]" />
                    <span className="text-sm">9 AI models from top providers</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                    <User className="w-5 h-5 text-[#1D4E5F]" />
                    <span className="text-sm">Your data, your control</span>
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Profile */}
            {currentStep === 1 && (
              <div>
                <h2 className="text-xl font-bold mb-2">Set up your profile</h2>
                <p className="text-gray-500 mb-6">Tell us a bit about yourself</p>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your name"
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Privacy */}
            {currentStep === 2 && (
              <div>
                <h2 className="text-xl font-bold mb-2">Choose your privacy level</h2>
                <p className="text-gray-500 mb-6">You can change this anytime in settings</p>
                <div className="space-y-3">
                  {[
                    {
                      id: 'standard',
                      name: 'Standard',
                      description: 'Data stored securely in Swiss data centers',
                      icon: '🔒'
                    },
                    {
                      id: 'vault',
                      name: 'Vault',
                      description: 'End-to-end encryption for maximum security',
                      icon: '🏦'
                    },
                    {
                      id: 'ghost',
                      name: 'Ghost',
                      description: 'Zero data retention - nothing stored on servers',
                      icon: '👻'
                    }
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setPrivacyMode(mode.id)}
                      className={`w-full p-4 rounded-lg border text-left transition-all ${
                        privacyMode === mode.id
                          ? 'border-[#1D4E5F] bg-[#1D4E5F]/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{mode.icon}</span>
                        <div>
                          <p className="font-medium">{mode.name}</p>
                          <p className="text-sm text-gray-500">{mode.description}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: First Task */}
            {currentStep === 3 && (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-xl font-bold mb-2">You're all set!</h2>
                <p className="text-gray-500 mb-6">
                  Your SwissBrain account is ready. Let's create your first AI task.
                </p>
                <div className="p-4 rounded-lg bg-gray-50 text-left">
                  <p className="font-medium mb-2">Try saying:</p>
                  <p className="text-sm text-gray-600 italic">
                    "Research the latest developments in renewable energy and create a summary report"
                  </p>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-8">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 0}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleNext}
                className="bg-[#1D4E5F] hover:bg-[#163d4d]"
              >
                {currentStep === STEPS.length - 1 ? 'Get Started' : 'Continue'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
