import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Mail, Check, Link2 } from 'lucide-react';
import { toast } from 'sonner';

interface ShareSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  summaryText: string;
  sessionId: string;
}

export function ShareSummaryModal({ isOpen, onClose, summaryText, sessionId }: ShareSummaryModalProps) {
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState('');

  const shareUrl = `${window.location.origin}/helios/summary/${sessionId}`;

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyText = async () => {
    await navigator.clipboard.writeText(summaryText);
    toast.success('Summary copied to clipboard');
  };

  const handleEmailShare = () => {
    const subject = encodeURIComponent('HELIOS AI Consult Summary');
    const body = encodeURIComponent(`Here is my AI health consultation summary:\n\n${summaryText}\n\nView full summary: ${shareUrl}`);
    window.open(`mailto:${email}?subject=${subject}&body=${body}`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Summary</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Copy link */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Share link
            </label>
            <div className="flex gap-2">
              <Input value={shareUrl} readOnly className="flex-1" />
              <Button variant="outline" size="icon" onClick={handleCopyLink}>
                {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Send via email
            </label>
            <div className="flex gap-2">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@clinic.com"
                className="flex-1"
              />
              <Button variant="outline" size="icon" onClick={handleEmailShare}>
                <Mail className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Copy text */}
          <Button variant="outline" className="w-full" onClick={handleCopyText}>
            <Copy className="h-4 w-4 mr-2" />
            Copy summary text
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Share your summary with your healthcare provider for follow-up care.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
