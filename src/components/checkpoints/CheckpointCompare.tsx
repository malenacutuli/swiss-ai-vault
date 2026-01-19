import { useMemo } from 'react';
import { ArrowRight, Plus, Minus, Equal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ServerCheckpoint } from '@/hooks/useCheckpoints';

interface CheckpointCompareProps {
  checkpointA: ServerCheckpoint | null;
  checkpointB: ServerCheckpoint | null;
  stateA?: Record<string, unknown>;
  stateB?: Record<string, unknown>;
}

interface DiffItem {
  key: string;
  type: 'added' | 'removed' | 'changed' | 'unchanged';
  valueA?: unknown;
  valueB?: unknown;
}

function computeDiff(
  objA: Record<string, unknown> = {},
  objB: Record<string, unknown> = {}
): DiffItem[] {
  const allKeys = new Set([...Object.keys(objA), ...Object.keys(objB)]);
  const diff: DiffItem[] = [];

  for (const key of allKeys) {
    const hasA = key in objA;
    const hasB = key in objB;
    const valueA = objA[key];
    const valueB = objB[key];

    if (!hasA && hasB) {
      diff.push({ key, type: 'added', valueB });
    } else if (hasA && !hasB) {
      diff.push({ key, type: 'removed', valueA });
    } else if (JSON.stringify(valueA) !== JSON.stringify(valueB)) {
      diff.push({ key, type: 'changed', valueA, valueB });
    } else {
      diff.push({ key, type: 'unchanged', valueA, valueB });
    }
  }

  // Sort by type: changed first, then added, removed, unchanged
  const typeOrder = { changed: 0, added: 1, removed: 2, unchanged: 3 };
  return diff.sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);
}

function DiffValue({ value, type }: { value: unknown; type: 'old' | 'new' }) {
  const str = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
  const maxLength = 100;
  const truncated = str.length > maxLength ? str.slice(0, maxLength) + '...' : str;

  return (
    <code
      className={cn(
        'text-xs px-2 py-1 rounded font-mono block whitespace-pre-wrap break-all',
        type === 'old'
          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
          : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      )}
    >
      {truncated}
    </code>
  );
}

export function CheckpointCompare({
  checkpointA,
  checkpointB,
  stateA,
  stateB,
}: CheckpointCompareProps) {
  const diff = useMemo(() => {
    if (!stateA || !stateB) return [];
    return computeDiff(stateA, stateB);
  }, [stateA, stateB]);

  const stats = useMemo(() => {
    return {
      added: diff.filter((d) => d.type === 'added').length,
      removed: diff.filter((d) => d.type === 'removed').length,
      changed: diff.filter((d) => d.type === 'changed').length,
      unchanged: diff.filter((d) => d.type === 'unchanged').length,
    };
  }, [diff]);

  if (!checkpointA || !checkpointB) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Select two checkpoints to compare
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Checkpoint Comparison</CardTitle>
        <div className="flex items-center gap-3 mt-2">
          <Badge variant="outline">v{checkpointA.version}</Badge>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <Badge variant="outline">v{checkpointB.version}</Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden">
        {/* Stats */}
        <div className="flex items-center gap-4 mb-4 pb-4 border-b">
          <div className="flex items-center gap-1.5">
            <Plus className="h-4 w-4 text-green-500" />
            <span className="text-sm">{stats.added} added</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Minus className="h-4 w-4 text-red-500" />
            <span className="text-sm">{stats.removed} removed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-amber-500 font-bold text-sm">~</span>
            <span className="text-sm">{stats.changed} changed</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Equal className="h-4 w-4" />
            <span className="text-sm">{stats.unchanged} unchanged</span>
          </div>
        </div>

        {/* Metadata comparison */}
        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Step</div>
            <div className="font-medium">
              {checkpointA.step_number}
              {checkpointA.step_number !== checkpointB.step_number && (
                <span className="text-muted-foreground"> → {checkpointB.step_number}</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Tokens</div>
            <div className="font-medium">
              {checkpointA.tokens_used.toLocaleString()}
              {checkpointA.tokens_used !== checkpointB.tokens_used && (
                <span
                  className={cn(
                    checkpointB.tokens_used > checkpointA.tokens_used
                      ? 'text-amber-500'
                      : 'text-green-500'
                  )}
                >
                  {' '}
                  → {checkpointB.tokens_used.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Diff list */}
        <ScrollArea className="h-[calc(100%-180px)]">
          <div className="space-y-3 pr-4">
            {diff
              .filter((d) => d.type !== 'unchanged')
              .map((item) => (
                <div
                  key={item.key}
                  className={cn(
                    'p-3 rounded-lg border',
                    item.type === 'added' && 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/10',
                    item.type === 'removed' && 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10',
                    item.type === 'changed' && 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/10'
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {item.type === 'added' && <Plus className="h-4 w-4 text-green-500" />}
                    {item.type === 'removed' && <Minus className="h-4 w-4 text-red-500" />}
                    {item.type === 'changed' && (
                      <span className="text-amber-500 font-bold">~</span>
                    )}
                    <span className="font-mono text-sm font-medium">{item.key}</span>
                  </div>

                  {item.type === 'added' && (
                    <DiffValue value={item.valueB} type="new" />
                  )}

                  {item.type === 'removed' && (
                    <DiffValue value={item.valueA} type="old" />
                  )}

                  {item.type === 'changed' && (
                    <div className="space-y-2">
                      <DiffValue value={item.valueA} type="old" />
                      <DiffValue value={item.valueB} type="new" />
                    </div>
                  )}
                </div>
              ))}

            {diff.filter((d) => d.type !== 'unchanged').length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No differences found between checkpoints
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
