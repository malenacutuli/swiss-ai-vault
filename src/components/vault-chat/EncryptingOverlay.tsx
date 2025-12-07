import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EncryptingOverlayProps {
  visible: boolean;
}

export function EncryptingOverlay({ visible }: EncryptingOverlayProps) {
  if (!visible) return null;

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-3 py-3 px-4",
        "bg-info/10 backdrop-blur-sm",
        "border-t border-info/20",
        "animate-fade-in"
      )}
    >
      <Lock className="h-4 w-4 text-info animate-spin" />
      <span className="text-sm text-info font-medium">
        Encrypting your message...
      </span>
      <div className="w-24 h-1.5 bg-info/20 rounded-full overflow-hidden">
        <div 
          className="h-full bg-info rounded-full animate-[progress_1s_ease-in-out_infinite]"
          style={{ width: '60%' }}
        />
      </div>
    </div>
  );
}
