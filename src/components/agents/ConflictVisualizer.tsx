import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, CheckCircle, Clock, GitMerge, Lock, Shield, Users, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConflictEvent, ResolutionResult } from '@/lib/agents/multiagent/ConflictResolver';
import type { WaitForEdge, LockInfo } from '@/lib/agents/multiagent/DeadlockPrevention';

interface ConflictVisualizerProps {
  pendingConflicts: ConflictEvent[];
  resolvedConflicts: ResolutionResult[];
  waitForGraph: { nodes: string[]; edges: WaitForEdge[] };
  currentLocks: LockInfo[];
  className?: string;
}

export function ConflictVisualizer({
  pendingConflicts,
  resolvedConflicts,
  waitForGraph,
  currentLocks,
  className,
}: ConflictVisualizerProps) {
  const [selectedConflict, setSelectedConflict] = useState<string | null>(null);

  const getConflictIcon = (type: string) => {
    switch (type) {
      case 'concurrent_write':
        return <GitMerge className="h-4 w-4" />;
      case 'resource_contention':
        return <Lock className="h-4 w-4" />;
      case 'task_overlap':
        return <Users className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getStrategyBadge = (strategy: string) => {
    const variants: Record<string, { color: string; label: string }> = {
      causal_order: { color: 'bg-blue-500/20 text-blue-400', label: 'Causal Order' },
      automatic_merge: { color: 'bg-green-500/20 text-green-400', label: 'Auto Merged' },
      priority_lock: { color: 'bg-amber-500/20 text-amber-400', label: 'Priority Lock' },
      first_claim: { color: 'bg-purple-500/20 text-purple-400', label: 'First Claim' },
      orchestrator_decision: { color: 'bg-red-500/20 text-red-400', label: 'Orchestrator' },
    };

    const variant = variants[strategy] || { color: 'bg-muted text-muted-foreground', label: strategy };
    return (
      <Badge className={cn('text-xs', variant.color)}>
        {variant.label}
      </Badge>
    );
  };

  const formatTimestamp = (ts: number) => {
    return new Date(ts).toLocaleTimeString();
  };

  return (
    <div className={cn('grid gap-4 md:grid-cols-2', className)}>
      {/* Pending Conflicts */}
      <Card className="border-destructive/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Pending Conflicts
            {pendingConflicts.length > 0 && (
              <Badge variant="destructive" className="ml-auto">
                {pendingConflicts.length}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Conflicts awaiting resolution</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            {pendingConflicts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Shield className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No pending conflicts</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingConflicts.map((conflict) => (
                  <div
                    key={conflict.id}
                    className={cn(
                      'p-3 rounded-lg border bg-card cursor-pointer transition-colors',
                      selectedConflict === conflict.id && 'border-primary'
                    )}
                    onClick={() => setSelectedConflict(conflict.id)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {getConflictIcon(conflict.type)}
                      <span className="text-sm font-medium capitalize">
                        {conflict.type.replace('_', ' ')}
                      </span>
                      <Clock className="h-3 w-3 ml-auto text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(conflict.detectedAt)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2 truncate">
                      Resource: {conflict.resource}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {conflict.contenders.map((c, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {c.agentId.split('-')[0]}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Resolved Conflicts */}
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CheckCircle className="h-5 w-5 text-primary" />
            Resolved Conflicts
            <Badge variant="secondary" className="ml-auto">
              {resolvedConflicts.length}
            </Badge>
          </CardTitle>
          <CardDescription>Successfully resolved conflicts</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            {resolvedConflicts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Zap className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No resolved conflicts yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {resolvedConflicts.slice(-10).reverse().map((result) => (
                  <div
                    key={result.conflictId}
                    className="p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {getStrategyBadge(result.strategy)}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatTimestamp(result.timestamp)}
                      </span>
                    </div>
                    {result.winner && (
                      <p className="text-sm">
                        <span className="text-muted-foreground">Winner: </span>
                        <span className="font-medium">{result.winner.agentId.split('-')[0]}</span>
                      </p>
                    )}
                    {result.merged && (
                      <p className="text-sm text-green-400">
                        Values successfully merged
                      </p>
                    )}
                    {result.losers && result.losers.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Deferred: {result.losers.map(l => l.split('-')[0]).join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Wait-For Graph */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            Wait-For Graph
          </CardTitle>
          <CardDescription>Agent dependencies and wait states</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            {waitForGraph.edges.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <CheckCircle className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No agents waiting</p>
              </div>
            ) : (
              <div className="space-y-2">
                {waitForGraph.edges.map((edge, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-2 rounded bg-muted/50"
                  >
                    <Badge variant="outline" className="text-xs">
                      {edge.waiting.split('-')[0]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">→ waiting for →</span>
                    <Badge variant="secondary" className="text-xs">
                      {edge.waitingFor.split('-')[0]}
                    </Badge>
                    <span className="text-xs text-muted-foreground ml-auto">
                      on: {edge.resource.split('/').pop()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Current Locks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="h-5 w-5" />
            Active Locks
            <Badge variant="outline" className="ml-auto">
              {currentLocks.length}
            </Badge>
          </CardTitle>
          <CardDescription>Resources currently locked by agents</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            {currentLocks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Lock className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No active locks</p>
              </div>
            ) : (
              <div className="space-y-2">
                {currentLocks.map((lock, i) => {
                  const isExpiringSoon = lock.expiresAt && (lock.expiresAt - Date.now()) < 10000;
                  return (
                    <div
                      key={i}
                      className={cn(
                        'p-2 rounded border bg-card',
                        isExpiringSoon && 'border-amber-500/50'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="text-xs">
                          {lock.holder.split('-')[0]}
                        </Badge>
                        {isExpiringSoon && (
                          <Badge variant="outline" className="text-xs text-amber-400">
                            Expiring
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {lock.resource}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Acquired: {formatTimestamp(lock.acquiredAt)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
