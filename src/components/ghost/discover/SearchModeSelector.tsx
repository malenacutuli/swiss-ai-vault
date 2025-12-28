import { cn } from '@/lib/utils';
import { 
  IconSearch, 
  IconBrain, 
  IconBulb 
} from '@tabler/icons-react';

export type SearchMode = 'search' | 'research' | 'reason';

interface SearchModeSelectorProps {
  mode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
}

export function SearchModeSelector({ mode, onModeChange }: SearchModeSelectorProps) {
  const modes = [
    { id: 'search' as const, label: 'Search', icon: IconSearch },
    { id: 'research' as const, label: 'Research', icon: IconBrain },
    { id: 'reason' as const, label: 'Reason', icon: IconBulb },
  ];

  return (
    <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
      {modes.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onModeChange(id)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
            mode === id
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Icon className="w-4 h-4" stroke={1.5} />
          {label}
        </button>
      ))}
    </div>
  );
}
