import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Clock,
  Save,
  Zap,
  Shield,
  Hash,
  FileCode,
  MessageSquare,
  Settings,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { ServerCheckpoint, CheckpointRestoreResult } from '@/hooks/useCheckpoints';

interface CheckpointDetailsProps {
  checkpoint: ServerCheckpoint | null;
  stateData?: Record<string, unknown>;
  contextData?: Record<string, unknown>;
  messagesData?: unknown[];
  onRestore?: () => void;
  isRestoring?: boolean;
}

const typeConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  manual: { icon: Save, color: 'text-blue-500', label: 'Manual Checkpoint' },
  auto: { icon: Clock, color: 'text-gray-500', label: 'Auto Checkpoint' },
  pre_tool: { icon: Shield, color: 'text-amber-500', label: 'Pre-Tool Safety Checkpoint' },
  post_step: { icon: Zap, color: 'text-green-500', label: 'Post-Step Checkpoint' },
};

function JsonViewer({ data, maxHeight = '200px' }: { data: unknown; maxHeight?: string }) {
  const [copied, setCopied] = useState(false);

  const jsonString = JSON.stringify(data, null, 2);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <Button
        size="icon"
        variant="ghost"
        className="absolute right-2 top-2 h-7 w-7 z-10"
        onClick={handleCopy}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
      <ScrollArea className="rounded-lg bg-muted/50 border" style={{ maxHeight }}>
        <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-all">
          {jsonString}
        </pre>
      </ScrollArea>
    </div>
  );
}

function CollapsibleSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
  badge,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">{title}</span>
            {badge !== undefined && (
              <Badge variant="secondary" className="text-xs">
                {badge}
              </Badge>
            )}
          </div>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pb-3 px-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function CheckpointDetails({
  checkpoint,
  stateData,
  contextData,
  messagesData,
  onRestore,
  isRestoring,
}: CheckpointDetailsProps) {
  if (!checkpoint) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full text-muted-foreground py-12">
          Select a checkpoint to view details
        </CardContent>
      </Card>
    );
  }

  const config = typeConfig[checkpoint.checkpoint_type] || typeConfig.auto;
  const Icon = config.icon;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Icon className={cn('h-5 w-5', config.color)} />
              <CardTitle className="text-lg">{config.label}</CardTitle>
            </div>
            <CardDescription>
              Version {checkpoint.version} - Step {checkpoint.step_number}
            </CardDescription>
          </div>
          {onRestore && checkpoint.is_valid && (
            <Button onClick={onRestore} disabled={isRestoring} size="sm">
              {isRestoring ? 'Restoring...' : 'Restore'}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-full pr-4">
          {/* Overview */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground mb-1">Tokens Used</div>
              <div className="text-lg font-semibold">
                {checkpoint.tokens_used.toLocaleString()}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground mb-1">Execution Time</div>
              <div className="text-lg font-semibold">
                {(checkpoint.execution_time_ms / 1000).toFixed(2)}s
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 col-span-2">
              <div className="text-xs text-muted-foreground mb-1">Created</div>
              <div className="text-sm font-medium">
                {format(new Date(checkpoint.created_at), 'PPpp')}
              </div>
            </div>
          </div>

          {/* Description */}
          {checkpoint.description && (
            <div className="mb-6">
              <h4 className="text-sm font-medium mb-2">Description</h4>
              <p className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/50">
                {checkpoint.description}
              </p>
            </div>
          )}

          {/* Status */}
          <div className="mb-6">
            <h4 className="text-sm font-medium mb-2">Status</h4>
            <div className="flex items-center gap-2">
              {checkpoint.is_valid ? (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                  Valid
                </Badge>
              ) : (
                <Badge variant="destructive">Invalid</Badge>
              )}
              <Badge variant="outline">
                {checkpoint.checkpoint_type.replace('_', ' ')}
              </Badge>
            </div>
          </div>

          {/* Data Sections */}
          <div className="space-y-2 border-t pt-4">
            {stateData && (
              <CollapsibleSection
                title="State Snapshot"
                icon={FileCode}
                badge={Object.keys(stateData).length}
              >
                <JsonViewer data={stateData} maxHeight="300px" />
              </CollapsibleSection>
            )}

            {contextData && (
              <CollapsibleSection
                title="Context"
                icon={Settings}
                badge={Object.keys(contextData).length}
              >
                <JsonViewer data={contextData} maxHeight="200px" />
              </CollapsibleSection>
            )}

            {messagesData && messagesData.length > 0 && (
              <CollapsibleSection
                title="Messages"
                icon={MessageSquare}
                badge={messagesData.length}
              >
                <JsonViewer data={messagesData} maxHeight="300px" />
              </CollapsibleSection>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
