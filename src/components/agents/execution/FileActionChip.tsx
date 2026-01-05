import { cn } from '@/lib/utils';

export type FileActionType = 'creating' | 'editing' | 'executing' | 'generating' | 'reading' | 'searching' | 'analyzing';

export interface FileAction {
  type: FileActionType;
  target: string;
}

const actionConfig: Record<FileActionType, { label: string; icon: string; bgClass: string }> = {
  creating: { label: 'Creating', icon: '📝', bgClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  editing: { label: 'Editing', icon: '✏️', bgClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  executing: { label: 'Executing', icon: '▶️', bgClass: 'bg-purple-50 text-purple-700 border-purple-200' },
  generating: { label: 'Generating', icon: '🖼️', bgClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  reading: { label: 'Reading', icon: '📖', bgClass: 'bg-slate-50 text-slate-700 border-slate-200' },
  searching: { label: 'Searching', icon: '🔍', bgClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  analyzing: { label: 'Analyzing', icon: '📊', bgClass: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
};

interface FileActionChipProps {
  action: FileAction;
  className?: string;
}

export function FileActionChip({ action, className }: FileActionChipProps) {
  const config = actionConfig[action.type];
  
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
        'transition-all duration-200 hover:scale-[1.02]',
        config.bgClass,
        className
      )}
    >
      <span className="flex-shrink-0">{config.icon}</span>
      <span className="font-medium">{config.label}</span>
      <span className="opacity-80 truncate max-w-[200px]">{action.target}</span>
    </span>
  );
}

// Helper to parse tool actions into file actions
export function parseToolToFileActions(toolName: string | null, description: string | null): FileAction[] {
  const actions: FileAction[] = [];
  
  if (!toolName && !description) return actions;
  
  const tool = toolName?.toLowerCase() || '';
  const desc = description?.toLowerCase() || '';
  
  // Map common tools to actions
  if (tool.includes('web_search') || tool.includes('search') || desc.includes('searching')) {
    actions.push({ type: 'searching', target: 'web' });
  }
  
  if (tool.includes('document_generator') || tool.includes('doc')) {
    if (desc.includes('pptx') || desc.includes('presentation')) {
      actions.push({ type: 'creating', target: 'presentation.pptx' });
    } else if (desc.includes('docx') || desc.includes('word')) {
      actions.push({ type: 'creating', target: 'document.docx' });
    } else if (desc.includes('xlsx') || desc.includes('excel') || desc.includes('spreadsheet')) {
      actions.push({ type: 'creating', target: 'spreadsheet.xlsx' });
    } else {
      actions.push({ type: 'creating', target: 'document' });
    }
  }
  
  if (tool.includes('image_generator') || tool.includes('image') || desc.includes('image')) {
    actions.push({ type: 'generating', target: 'image' });
  }
  
  if (tool.includes('code') || desc.includes('code')) {
    actions.push({ type: 'executing', target: 'code' });
  }
  
  if (tool.includes('read') || desc.includes('reading') || desc.includes('analyzing')) {
    actions.push({ type: 'analyzing', target: 'data' });
  }
  
  // If no specific actions detected, add a generic one based on description
  if (actions.length === 0 && description) {
    if (desc.includes('creat') || desc.includes('generat')) {
      actions.push({ type: 'creating', target: 'output' });
    } else if (desc.includes('analyz')) {
      actions.push({ type: 'analyzing', target: 'content' });
    }
  }
  
  return actions;
}
