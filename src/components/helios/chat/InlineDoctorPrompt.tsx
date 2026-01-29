/**
 * Inline Doctor Prompt
 * Smaller CTA that appears after every AI response post-diagnosis
 */

import React from 'react';
import { Video } from 'lucide-react';

interface InlineDoctorPromptProps {
  onBook: () => void;
}

export function InlineDoctorPrompt({ onBook }: InlineDoctorPromptProps) {
  return (
    <div className="flex items-center gap-3 mt-4 p-3 bg-gray-50 rounded-lg">
      <Video className="w-5 h-5 text-blue-600" />
      <span className="text-sm text-gray-600">
        Would you like to discuss this with a doctor?
      </span>
      <button
        onClick={onBook}
        className="text-sm font-medium text-blue-600 hover:text-blue-700 underline"
      >
        Book Video Visit
      </button>
    </div>
  );
}
