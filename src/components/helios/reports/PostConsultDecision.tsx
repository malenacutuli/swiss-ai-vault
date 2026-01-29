/**
 * Post Consult Decision
 * Displayed after consult completion with next step options
 */

import React from 'react';
import { Video, MessageCircle, FileText, Share2, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PostConsultDecisionProps {
  onSeeDoctor: () => void;
  onContinueChat: () => void;
  onViewSOAP: () => void;
  onShare: () => void;
  onGoHome: () => void;
}

export function PostConsultDecision({
  onSeeDoctor,
  onContinueChat,
  onViewSOAP,
  onShare,
  onGoHome,
}: PostConsultDecisionProps) {
  return (
    <div className="max-w-md mx-auto text-center py-8">
      <h2 className="text-2xl font-semibold mb-2">What would you like to do next?</h2>
      <p className="text-gray-600 mb-8">
        Your AI consult is complete. Choose how to proceed.
      </p>

      <div className="space-y-3">
        {/* Primary CTA */}
        <Button
          onClick={onSeeDoctor}
          className="w-full h-14 text-lg bg-[#2196F3] hover:bg-[#1976D2]"
        >
          <Video className="w-5 h-5 mr-2" />
          See a Doctor Now
        </Button>

        {/* Secondary options */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={onContinueChat}
            variant="outline"
            className="h-12"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Continue Chat
          </Button>

          <Button
            onClick={onViewSOAP}
            variant="outline"
            className="h-12"
          >
            <FileText className="w-4 h-4 mr-2" />
            View Summary
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={onShare}
            variant="outline"
            className="h-12"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>

          <Button
            onClick={onGoHome}
            variant="outline"
            className="h-12"
          >
            <Home className="w-4 h-4 mr-2" />
            Home
          </Button>
        </div>
      </div>

      {/* Doctor availability */}
      <p className="text-sm text-gray-500 mt-6">
        Video appointments available immediately. $39 or use insurance.
      </p>
    </div>
  );
}
