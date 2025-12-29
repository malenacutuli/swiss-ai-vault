import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MessageSquare, Image, Video, Globe } from '@/icons';
import { useTranslation } from 'react-i18next';

export type GhostMode = 'text' | 'image' | 'video' | 'search';

interface GhostModeTabsProps {
  activeMode: GhostMode;
  onModeChange: (mode: GhostMode) => void;
  className?: string;
}

const MODES: { id: GhostMode; labelKey: string; icon: React.ElementType; isNew?: boolean }[] = [
  { id: 'text', labelKey: 'ghost.modes.text', icon: MessageSquare },
  { id: 'image', labelKey: 'ghost.modes.image', icon: Image, isNew: true },
  { id: 'video', labelKey: 'ghost.modes.video', icon: Video, isNew: true },
  { id: 'search', labelKey: 'ghost.modes.search', icon: Globe },
];

export function GhostModeTabs({
  activeMode,
  onModeChange,
  className,
}: GhostModeTabsProps) {
  const { t } = useTranslation();
  
  return (
    <div className={cn('flex items-center gap-0.5 p-1 bg-muted/40 rounded-xl', className)}>
      {MODES.map(({ id, labelKey, icon: Icon, isNew }) => (
        <Button
          key={id}
          variant="ghost"
          size="sm"
          onClick={() => onModeChange(id)}
          className={cn(
            'relative h-8 px-3 gap-2 font-medium text-[13px] rounded-lg transition-all duration-150',
            activeMode === id
              ? 'bg-background text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
          )}
        >
          <Icon className="w-4 h-4" />
          <span className="hidden sm:inline">{t(labelKey)}</span>
          {isNew && (
            <span className="absolute -top-1 -right-0.5 text-[9px] font-semibold text-primary bg-primary/10 px-1 rounded">
              {t('ghost.modes.new')}
            </span>
          )}
        </Button>
      ))}
    </div>
  );
}