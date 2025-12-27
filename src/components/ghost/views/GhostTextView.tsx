import { SwissHeading } from '@/components/ui/swiss';
import { Sparkles } from 'lucide-react';
import swissVaultLogo from '@/assets/swissvault-logo.png';

interface GhostTextViewProps {
  hasMessages: boolean;
  children?: React.ReactNode;
}

export function GhostTextView({ hasMessages, children }: GhostTextViewProps) {
  if (!hasMessages) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 overflow-hidden">
          <img src={swissVaultLogo} alt="SwissVault" className="w-16 h-16" />
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
    <div className="flex-1 flex flex-col overflow-hidden">
      {children}
    </div>
  );
}
