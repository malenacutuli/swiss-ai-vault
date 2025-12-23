import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SwissHeading } from '@/components/ui/swiss';
import { MessageSquare, Image, Video, Globe } from 'lucide-react';

export type GhostMode = 'text' | 'image' | 'video' | 'search';

interface GhostModeTabsProps {
  activeMode: GhostMode;
  onModeChange: (mode: GhostMode) => void;
  className?: string;
}

const MODES: { id: GhostMode; label: string; icon: React.ElementType }[] = [
  { id: 'text', label: 'Text', icon: MessageSquare },
  { id: 'image', label: 'Image', icon: Image },
  { id: 'video', label: 'Video', icon: Video },
  { id: 'search', label: 'Search', icon: Globe },
];

export function GhostModeTabs({
  activeMode,
  onModeChange,
  className,
}: GhostModeTabsProps) {
  return (
    <div className={cn('flex items-center gap-1 p-1 bg-muted/30 rounded-lg', className)}>
      {MODES.map(({ id, label, icon: Icon }) => (
        <Button
          key={id}
          variant="ghost"
          size="sm"
          onClick={() => onModeChange(id)}
          className={cn(
            'h-9 px-4 gap-2 font-medium transition-all',
            activeMode === id
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
          )}
        >
          <Icon className="w-4 h-4" />
          <span className="hidden sm:inline">{label}</span>
        </Button>
      ))}
    </div>
  );
}
