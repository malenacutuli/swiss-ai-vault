import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const PRIMARY_ACTIONS = [
  { id: 'slides', label: 'Create slides' },
  { id: 'document', label: 'Write document' },
  { id: 'research', label: 'Research' },
  { id: 'analyze', label: 'Analyze data' },
];

const MORE_ACTIONS = [
  { id: 'spreadsheet', label: 'Spreadsheet' },
  { id: 'schedule', label: 'Schedule task' },
  { id: 'email', label: 'Draft email' },
  { id: 'code', label: 'Write code' },
  { id: 'image', label: 'Generate image' },
  { id: 'summary', label: 'Summarize' },
];

interface QuickActionBarProps {
  onSelect: (actionId: string) => void;
  selectedAction: string | null;
  className?: string;
}

export function QuickActionBar({ onSelect, selectedAction, className }: QuickActionBarProps) {
  const selectedMoreAction = MORE_ACTIONS.find(a => a.id === selectedAction);
  
  return (
    <div className={cn('flex flex-wrap items-center justify-center gap-2', className)}>
      {PRIMARY_ACTIONS.map((action) => (
        <button
          key={action.id}
          onClick={() => onSelect(selectedAction === action.id ? '' : action.id)}
          className={cn(
            'px-4 py-2 rounded-full border text-sm font-medium transition-all duration-200',
            selectedAction === action.id
              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
              : 'bg-card text-foreground border-border hover:border-primary/30 hover:bg-muted/50'
          )}
        >
          {action.label}
        </button>
      ))}
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-medium transition-all duration-200',
              selectedMoreAction
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-card text-foreground border-border hover:border-primary/30 hover:bg-muted/50'
            )}
          >
            {selectedMoreAction ? (
              <span>{selectedMoreAction.label}</span>
            ) : (
              <>
                <span>More</span>
                <span className="text-xs opacity-70">▼</span>
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="center" 
          className="w-48 bg-card border-border shadow-lg z-50"
        >
          {MORE_ACTIONS.map((action) => (
            <DropdownMenuItem
              key={action.id}
              onClick={() => onSelect(selectedAction === action.id ? '' : action.id)}
              className={cn(
                'cursor-pointer',
                selectedAction === action.id && 'bg-primary/10 text-primary'
              )}
            >
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
