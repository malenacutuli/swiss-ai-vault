/**
 * AI Visit Required Modal
 * Prompts user to complete AI consult before booking
 */

import React from 'react';
import { X, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AIVisitRequiredModalProps {
  onClose: () => void;
  onStartAI: () => void;
}

export function AIVisitRequiredModal({ onClose, onStartAI }: AIVisitRequiredModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-semibold">AI Doctor Visit Required</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Stethoscope className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="font-medium mb-1">Please Chat With Our AI Doctor First</p>
            <p className="text-gray-600 text-sm">
              Our AI doctor assessment helps our human doctors prepare for your
              video visit and provide better care.
            </p>
          </div>
        </div>

        <Button
          onClick={onStartAI}
          className="w-full h-12 bg-[#2196F3] hover:bg-[#1976D2]"
        >
          Start My AI Doctor Visit
        </Button>
      </div>
    </div>
  );
}
