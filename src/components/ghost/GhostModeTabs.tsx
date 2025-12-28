import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
    <div className={cn('flex items-center gap-0.5 p-1 bg-muted/40 rounded-xl', className)}>
      {MODES.map(({ id, label, icon: Icon }) => (
        <Button
          key={id}
          variant="ghost"
          size="sm"
          onClick={() => onModeChange(id)}
          className={cn(
            'h-8 px-3 gap-2 font-medium text-[13px] rounded-lg transition-all duration-150',
            activeMode === id
              ? 'bg-background text-foreground shadow-card'
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