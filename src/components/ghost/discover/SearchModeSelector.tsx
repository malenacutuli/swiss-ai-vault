import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { 
  Search, 
  Brain, 
  Lightbulb 
} from '@/icons';

export type SearchMode = 'search' | 'research' | 'reason';

interface SearchModeSelectorProps {
  mode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
}

export function SearchModeSelector({ mode, onModeChange }: SearchModeSelectorProps) {
  const { t } = useTranslation();
  
  const modes = [
    { id: 'search' as const, labelKey: 'ghost.discover.modes.search', fallback: 'Search', icon: Search },
    { id: 'research' as const, labelKey: 'ghost.discover.modes.research', fallback: 'Research', icon: Brain },
    { id: 'reason' as const, labelKey: 'ghost.discover.modes.reason', fallback: 'Reason', icon: Lightbulb },
  ];

  return (
    <div className="flex items-center gap-4">
      {modes.map(({ id, labelKey, fallback, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onModeChange(id)}
          className={cn(
            "flex items-center gap-1.5 text-sm font-medium transition-all",
            mode === id
              ? "text-swiss-teal"
              : "text-muted-foreground hover:text-swiss-teal/80"
          )}
        >
          <Icon className="w-4 h-4 text-swiss-teal" strokeWidth={1.25} />
          {t(labelKey, fallback)}
        </button>
      ))}
    </div>
  );
}