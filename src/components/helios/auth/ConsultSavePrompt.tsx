/**
 * Consult Save Prompt
 * Prompts guest users to save their consult before leaving
 */

import React from 'react';
import { X, Save, Trash2, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ConsultSavePromptProps {
  onSave: () => void;
  onDiscard: () => void;
  onSignIn: () => void;
  onClose: () => void;
}

export function ConsultSavePrompt({
  onSave,
  onDiscard,
  onSignIn,
  onClose,
}: ConsultSavePromptProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Save Your Consult?</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-gray-600 mb-6">
            You have an unsaved AI consult. Would you like to save it to your health record?
          </p>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              onClick={onSignIn}
              className="w-full bg-[#2196F3] hover:bg-[#1976D2]"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Sign In to Save
            </Button>

            <Button
              onClick={onSave}
              variant="outline"
              className="w-full"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Locally (Guest)
            </Button>

            <Button
              onClick={onDiscard}
              variant="ghost"
              className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Discard Consult
            </Button>
          </div>

          <p className="text-xs text-gray-400 text-center mt-4">
            Guest data is stored locally and may be lost if you clear your browser data.
          </p>
        </div>
      </div>
    </div>
  );
}
