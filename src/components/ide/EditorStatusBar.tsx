import React from 'react';
import { cn } from '@/lib/utils';
import { GitBranch, AlertCircle, CheckCircle2 } from 'lucide-react';

interface EditorStatusBarProps {
  line: number;
  column: number;
  language: string;
  encoding?: string;
  eol?: string;
  indentation?: string;
  errors?: number;
  warnings?: number;
  branch?: string;
  className?: string;
}

export function EditorStatusBar({
  line,
  column,
  language,
  encoding = 'UTF-8',
  eol = 'LF',
  indentation = 'Spaces: 2',
  errors = 0,
  warnings = 0,
  branch,
  className,
}: EditorStatusBarProps) {
  return (
    <div className={cn(
      'h-6 px-3 flex items-center justify-between border-t border-border bg-muted/50 text-xs',
      className
    )}>
      {/* Left side */}
      <div className="flex items-center gap-4">
        {branch && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <GitBranch className="h-3 w-3" />
            <span>{branch}</span>
          </div>
        )}
        
        <div className="flex items-center gap-2">
          {errors > 0 ? (
            <div className="flex items-center gap-1 text-destructive">
              <AlertCircle className="h-3 w-3" />
              <span>{errors}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-success">
              <CheckCircle2 className="h-3 w-3" />
              <span>0</span>
            </div>
          )}
          {warnings > 0 && (
            <div className="flex items-center gap-1 text-warning">
              <AlertCircle className="h-3 w-3" />
              <span>{warnings}</span>
            </div>
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4 text-muted-foreground">
        <span>
          Ln {line}, Col {column}
        </span>
        <span>{indentation}</span>
        <span>{encoding}</span>
        <span>{eol}</span>
        <span className="capitalize">{language}</span>
      </div>
    </div>
  );
}
