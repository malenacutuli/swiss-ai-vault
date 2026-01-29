/**
 * Sign In Prompt
 * Encourages guest users to sign in to save their consult
 */

import React from 'react';
import { X, Shield, Save, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SignInPromptProps {
  variant?: 'modal' | 'banner';
  onSignIn: () => void;
  onContinueGuest: () => void;
}

export function SignInPrompt({
  variant = 'modal',
  onSignIn,
  onContinueGuest,
}: SignInPromptProps) {
  if (variant === 'banner') {
    return (
      <div className="bg-blue-50 border-b border-blue-100 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-blue-800">
              Sign in to save your health data securely
            </span>
          </div>
          <Button
            onClick={onSignIn}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
          >
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full">
        <div className="p-6">
          {/* Close button */}
          <div className="flex justify-end">
            <button
              onClick={onContinueGuest}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Icon */}
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-blue-600" />
          </div>

          {/* Title */}
          <h2 className="text-2xl font-semibold text-center mb-2">
            Save Your Health Journey
          </h2>

          <p className="text-gray-600 text-center mb-6">
            Sign in to securely save your consults, health records, and access them anytime.
          </p>

          {/* Benefits */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3 text-sm">
              <Save className="w-5 h-5 text-green-500" />
              <span>Save consults & health history</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Clock className="w-5 h-5 text-green-500" />
              <span>Access your data across devices</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Shield className="w-5 h-5 text-green-500" />
              <span>End-to-end encrypted storage</span>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              onClick={onSignIn}
              className="w-full bg-[#2196F3] hover:bg-[#1976D2]"
            >
              Sign In
            </Button>
            <Button
              onClick={onContinueGuest}
              variant="ghost"
              className="w-full text-gray-500"
            >
              Continue as Guest
            </Button>
          </div>

          <p className="text-xs text-gray-400 text-center mt-4">
            Your health data is encrypted and stored only on your device.
            We never have access to your medical information.
          </p>
        </div>
      </div>
    </div>
  );
}
