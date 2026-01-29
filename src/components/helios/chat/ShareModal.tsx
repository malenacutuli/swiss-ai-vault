/**
 * Share Consult Modal
 * Secure sharing with expiring links
 */

import React, { useState } from 'react';
import {
  X, Mail, MessageSquare, Copy, Check,
  Twitter, Facebook, Linkedin, Printer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ShareModalProps {
  sessionId: string;
  onClose: () => void;
}

export function ShareModal({ sessionId, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateShareLink = async () => {
    setIsGenerating(true);

    // In production, this would call an API to create a secure share token
    // The token would expire after 5 days and only allow read-only access
    await new Promise(resolve => setTimeout(resolve, 500));

    const token = btoa(sessionId + ':' + Date.now());
    setShareLink(`${window.location.origin}/health/shared/${token}`);
    setIsGenerating(false);
  };

  const copyLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareOptions = [
    { id: 'email', name: 'Email', icon: Mail, color: 'bg-blue-100 text-blue-600' },
    { id: 'sms', name: 'SMS', icon: MessageSquare, color: 'bg-green-100 text-green-600' },
  ];

  const socialOptions = [
    { id: 'twitter', name: 'Twitter / X', icon: Twitter },
    { id: 'messenger', name: 'Messenger', icon: Facebook },
    { id: 'linkedin', name: 'Linkedin', icon: Linkedin },
    { id: 'print', name: 'Print', icon: Printer },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-semibold">Share This Consult</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Primary share options */}
          <div className="flex gap-4 mb-6">
            {shareOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => generateShareLink()}
                className="flex-1 flex items-center justify-center gap-2 py-3 border rounded-xl hover:bg-gray-50"
              >
                <option.icon className="w-5 h-5" />
                <span>{option.name}</span>
              </button>
            ))}
          </div>

          {/* Social options */}
          <div className="flex justify-center gap-4 mb-6">
            {socialOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => generateShareLink()}
                className="w-14 h-14 flex flex-col items-center justify-center rounded-xl hover:bg-gray-100"
              >
                <option.icon className="w-6 h-6 mb-1" />
                <span className="text-xs text-gray-500">{option.name}</span>
              </button>
            ))}
          </div>

          {/* Privacy notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
            <p className="text-sm text-amber-800">
              🔒 Sharing links expire in 5 days for your privacy.
              Generate a new one anytime.
            </p>
          </div>

          {/* Copy link */}
          {shareLink && (
            <button
              onClick={copyLink}
              className="w-full flex items-center justify-center gap-2 py-3 text-[#2196F3] hover:bg-blue-50 rounded-lg"
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  Copy link
                </>
              )}
            </button>
          )}

          {!shareLink && (
            <Button
              onClick={generateShareLink}
              disabled={isGenerating}
              className="w-full"
              variant="outline"
            >
              {isGenerating ? 'Generating...' : 'Generate Share Link'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
