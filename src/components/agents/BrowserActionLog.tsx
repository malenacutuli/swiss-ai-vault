import { useState, useEffect } from 'react';
import { 
  Navigation, 
  MousePointer, 
  Type, 
  Camera, 
  ScrollText, 
  Clock, 
  CheckCircle2, 
  XCircle,
  ChevronDown,
  ChevronRight,
  Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface BrowserAction {
  id: string;
  tool: string;
  params: Record<string, unknown>;
  result: Record<string, unknown> | null;
  timestamp: Date;
  duration: number;
  success: boolean;
  error?: string;
}

interface BrowserActionLogProps {
  taskId: string;
  className?: string;
  maxHeight?: string;
}

const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'browser.navigate': Navigation,
  'browser.click': MousePointer,
  'browser.type': Type,
  'browser.screenshot': Camera,
  'browser.scroll': ScrollText,
};

const TOOL_COLORS: Record<string, string> = {
  'browser.navigate': 'text-blue-500',
  'browser.click': 'text-purple-500',
  'browser.type': 'text-green-500',
  'browser.screenshot': 'text-orange-500',
  'browser.scroll': 'text-cyan-500',
};

function formatActionParams(params: Record<string, unknown>): string {
  if (params.url) return String(params.url);
  if (params.selector) return String(params.selector);
  if (params.text) return String(params.text).substring(0, 50) + (String(params.text).length > 50 ? '...' : '');
  return JSON.stringify(params).substring(0, 50);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getToolDisplayName(tool: string): string {
  return tool.replace('browser.', '').replace(/([A-Z])/g, ' $1').trim();
}

export function BrowserActionLog({ 
  taskId, 
  className,
  maxHeight = '400px',
}: BrowserActionLogProps) {
  const [actions, setActions] = useState<BrowserAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<string | null>(null);

  // Fetch existing actions
  useEffect(() => {
    async function fetchActions() {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('browser_actions')
        .select(`
          id,
          action_type,
          action_data,
          result,
          created_at
        `)
        .eq('session_id', taskId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        const formattedActions: BrowserAction[] = data.map((action) => ({
          id: action.id,
          tool: action.action_type,
          params: action.action_data as Record<string, unknown>,
          result: action.result as Record<string, unknown> | null,
          timestamp: new Date(action.created_at || ''),
          duration: (action.result as any)?.duration || 0,
          success: (action.result as any)?.success !== false,
          error: (action.result as any)?.error,
        }));
        setActions(formattedActions);
      }
      
      setIsLoading(false);
    }

    if (taskId) {
      fetchActions();
    }
  }, [taskId]);

  // Subscribe to new actions
  useEffect(() => {
    if (!taskId) return;

    const channel = supabase
      .channel(`browser-actions-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'browser_actions',
        },
        (payload) => {
          const newAction = payload.new as {
            id: string;
            action_type: string;
            action_data: Record<string, unknown>;
            result: Record<string, unknown> | null;
            created_at: string;
          };

          const formattedAction: BrowserAction = {
            id: newAction.id,
            tool: newAction.action_type,
            params: newAction.action_data,
            result: newAction.result,
            timestamp: new Date(newAction.created_at),
            duration: (newAction.result as any)?.duration || 0,
            success: (newAction.result as any)?.success !== false,
            error: (newAction.result as any)?.error,
          };

          setActions(prev => [...prev, formattedAction]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId]);

  const toggleExpanded = (actionId: string) => {
    setExpandedActions(prev => {
      const next = new Set(prev);
      if (next.has(actionId)) {
        next.delete(actionId);
      } else {
        next.add(actionId);
      }
      return next;
    });
  };

  const filteredActions = filter 
    ? actions.filter(a => a.tool === filter)
    : actions;

  const uniqueTools = [...new Set(actions.map(a => a.tool))];

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-8', className)}>
        <div className="text-sm text-muted-foreground">Loading actions...</div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <h3 className="text-sm font-medium">Browser Actions</h3>
        <div className="flex items-center gap-2">
          {uniqueTools.length > 1 && (
            <div className="flex items-center gap-1">
              <Filter className="h-3 w-3 text-muted-foreground" />
              <select
                value={filter || ''}
                onChange={(e) => setFilter(e.target.value || null)}
                className="text-xs bg-transparent border-0 focus:ring-0"
              >
                <option value="">All</option>
                {uniqueTools.map(tool => (
                  <option key={tool} value={tool}>
                    {getToolDisplayName(tool)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Badge variant="secondary" className="text-xs">
            {filteredActions.length}
          </Badge>
        </div>
      </div>

      {/* Action List */}
      <ScrollArea style={{ maxHeight }} className="flex-1">
        {filteredActions.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            No browser actions yet
          </div>
        ) : (
          <div className="divide-y">
            {filteredActions.map((action, index) => {
              const Icon = TOOL_ICONS[action.tool] || Navigation;
              const colorClass = TOOL_COLORS[action.tool] || 'text-muted-foreground';
              const isExpanded = expandedActions.has(action.id);

              return (
                <Collapsible
                  key={action.id}
                  open={isExpanded}
                  onOpenChange={() => toggleExpanded(action.id)}
                >
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors text-left">
                      {/* Step Number */}
                      <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium flex-shrink-0">
                        {index + 1}
                      </span>

                      {/* Tool Icon */}
                      <Icon className={cn('h-4 w-4 flex-shrink-0', colorClass)} />

                      {/* Tool Name & Params */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium capitalize">
                            {getToolDisplayName(action.tool)}
                          </span>
                          {action.success ? (
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                          ) : (
                            <XCircle className="h-3 w-3 text-destructive" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {formatActionParams(action.params)}
                        </p>
                      </div>

                      {/* Duration */}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                        <Clock className="h-3 w-3" />
                        {formatDuration(action.duration)}
                      </div>

                      {/* Expand Icon */}
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="px-3 py-2 bg-muted/30 border-t space-y-2">
                      {/* Params */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Parameters</p>
                        <pre className="text-xs bg-background rounded p-2 overflow-x-auto">
                          {JSON.stringify(action.params, null, 2)}
                        </pre>
                      </div>

                      {/* Result */}
                      {action.result && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Result</p>
                          <pre className="text-xs bg-background rounded p-2 overflow-x-auto max-h-32">
                            {JSON.stringify(action.result, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Error */}
                      {action.error && (
                        <div>
                          <p className="text-xs font-medium text-destructive mb-1">Error</p>
                          <p className="text-xs text-destructive bg-destructive/10 rounded p-2">
                            {action.error}
                          </p>
                        </div>
                      )}

                      {/* Timestamp */}
                      <p className="text-xs text-muted-foreground">
                        {action.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
