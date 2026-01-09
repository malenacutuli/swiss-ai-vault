import { useState, useEffect } from 'react';
import { FileText, Download, Copy, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PlanVisualizer } from './PlanVisualizer';
import { useAgentPlan } from '@/hooks/useAgentPlan';
import type { TodoPlan } from '@/lib/agents/planning';

interface PlanPanelProps {
  taskId?: string;
  initialPlan?: TodoPlan;
  onPlanUpdate?: (plan: TodoPlan) => void;
  className?: string;
}

export function PlanPanel({ 
  taskId, 
  initialPlan,
  onPlanUpdate,
  className,
}: PlanPanelProps) {
  const [activeTab, setActiveTab] = useState<'visual' | 'markdown'>('visual');
  const [copied, setCopied] = useState(false);

  const {
    plan,
    isLoading,
    isSaving,
    lastSaved,
    serialize,
    savePlan,
  } = useAgentPlan({
    taskId,
    onPlanUpdate,
  });

  // Use initial plan if no plan loaded
  const displayPlan = plan || initialPlan;
  const markdown = displayPlan ? serialize() : '';

  const handleCopy = async () => {
    if (!markdown) return;
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!markdown || !displayPlan) return;
    
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${displayPlan.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-plan.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!displayPlan) {
    return (
      <div className={cn("flex flex-col items-center justify-center p-8 text-center", className)}>
        <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">No execution plan</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Execution Plan</span>
          {isSaving && (
            <Badge variant="outline" className="text-[10px] animate-pulse">
              Saving...
            </Badge>
          )}
          {lastSaved && !isSaving && (
            <span className="text-[10px] text-muted-foreground">
              Saved {formatTimeAgo(lastSaved)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleDownload}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'visual' | 'markdown')} className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-3 w-fit">
          <TabsTrigger value="visual" className="text-xs">Visual</TabsTrigger>
          <TabsTrigger value="markdown" className="text-xs">Markdown</TabsTrigger>
        </TabsList>

        <TabsContent value="visual" className="flex-1 m-0 p-0">
          <ScrollArea className="h-full p-4">
            <PlanVisualizer plan={displayPlan} />
          </ScrollArea>
        </TabsContent>

        <TabsContent value="markdown" className="flex-1 m-0 p-0">
          <ScrollArea className="h-full">
            <pre className="p-4 text-xs font-mono text-muted-foreground whitespace-pre-wrap">
              {markdown}
            </pre>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}
