import { SwissHeading } from '@/components/ui/swiss';
import { MessageSquare, Sparkles } from 'lucide-react';

interface GhostTextViewProps {
  hasMessages: boolean;
  children?: React.ReactNode;
}

export function GhostTextView({ hasMessages, children }: GhostTextViewProps) {
  if (!hasMessages) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-swiss-navy/10 border border-swiss-navy/20 flex items-center justify-center mb-6">
          <MessageSquare className="w-8 h-8 text-swiss-navy" />
        </div>
        <h2 className="text-xs text-muted-foreground uppercase tracking-wider font-sans text-center mb-3">
          Private AI Chat
        </h2>
        <p className="text-muted-foreground text-center max-w-md">
          Your conversations are encrypted locally and never leave your device.
          Start typing to begin a private conversation.
        </p>
        <div className="flex items-center gap-2 mt-6 text-sm text-muted-foreground">
          <Sparkles className="w-4 h-4" />
          <span>Powered by Swiss-hosted AI models</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {children}
    </div>
  );
}
