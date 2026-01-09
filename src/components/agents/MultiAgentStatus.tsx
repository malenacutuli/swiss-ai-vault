import { useState, useEffect } from 'react';
import { 
  Users, 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2,
  Brain,
  Search,
  Code,
  BarChart3,
  FileCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AgentRole } from '@/lib/agents/multiagent';

interface AgentInstance {
  id: string;
  agent_id: string;
  role: string;
  status: string;
  current_subtask: string | null;
  metrics: {
    tasksCompleted: number;
    tasksFailed: number;
    avgDurationMs: number;
  };
  last_heartbeat: string;
}

interface MultiAgentStatusProps {
  taskId: string;
  className?: string;
}

const ROLE_ICONS: Record<AgentRole, React.ComponentType<{ className?: string }>> = {
  orchestrator: Brain,
  researcher: Search,
  coder: Code,
  analyst: BarChart3,
  reviewer: FileCheck,
  browser: Activity,
  writer: FileCheck,
};

const ROLE_COLORS: Record<AgentRole, string> = {
  orchestrator: 'text-purple-500 bg-purple-500/10',
  researcher: 'text-blue-500 bg-blue-500/10',
  coder: 'text-green-500 bg-green-500/10',
  analyst: 'text-orange-500 bg-orange-500/10',
  reviewer: 'text-cyan-500 bg-cyan-500/10',
  browser: 'text-pink-500 bg-pink-500/10',
  writer: 'text-yellow-500 bg-yellow-500/10',
};

const STATUS_CONFIG: Record<string, { color: string; icon: React.ComponentType<{ className?: string }> }> = {
  idle: { color: 'text-muted-foreground', icon: Clock },
  busy: { color: 'text-blue-500', icon: Loader2 },
  waiting: { color: 'text-yellow-500', icon: Clock },
  error: { color: 'text-destructive', icon: XCircle },
  terminated: { color: 'text-muted-foreground', icon: XCircle },
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function getTimeSinceHeartbeat(heartbeat: string): string {
  const diff = Date.now() - new Date(heartbeat).getTime();
  if (diff < 10000) return 'just now';
  if (diff < 60000) return `${Math.round(diff / 1000)}s ago`;
  return `${Math.round(diff / 60000)}m ago`;
}

export function MultiAgentStatus({ taskId, className }: MultiAgentStatusProps) {
  const [agents, setAgents] = useState<AgentInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch agents
  useEffect(() => {
    async function fetchAgents() {
      const { data, error } = await supabase
        .from('agent_instances')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setAgents(data.map((d) => ({
          ...d,
          metrics: (d.metrics as AgentInstance['metrics']) || { tasksCompleted: 0, tasksFailed: 0, avgDurationMs: 0 },
        })));
      }
      setIsLoading(false);
    }

    if (taskId) {
      fetchAgents();
    }
  }, [taskId]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!taskId) return;

    const channel = supabase
      .channel(`agents-status-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_instances',
          filter: `task_id=eq.${taskId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setAgents((prev) => [...prev, payload.new as AgentInstance]);
          } else if (payload.eventType === 'UPDATE') {
            setAgents((prev) =>
              prev.map((a) =>
                a.id === payload.new.id ? (payload.new as AgentInstance) : a
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setAgents((prev) => prev.filter((a) => a.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId]);

  const activeAgents = agents.filter((a) => a.status === 'busy');
  const totalTasks = agents.reduce(
    (sum, a) => sum + (a.metrics?.tasksCompleted || 0) + (a.metrics?.tasksFailed || 0),
    0
  );
  const completedTasks = agents.reduce(
    (sum, a) => sum + (a.metrics?.tasksCompleted || 0),
    0
  );

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-8', className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Agents</p>
              <p className="text-lg font-semibold">{agents.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">Active</p>
              <p className="text-lg font-semibold">{activeAgents.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">Tasks</p>
              <p className="text-lg font-semibold">
                {completedTasks}/{totalTasks}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Agent List */}
      <div className="space-y-2">
        {agents.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No agents active
          </div>
        ) : (
          agents.map((agent) => {
            const role = agent.role as AgentRole;
            const Icon = ROLE_ICONS[role] || Activity;
            const statusConfig = STATUS_CONFIG[agent.status] || STATUS_CONFIG.idle;
            const StatusIcon = statusConfig.icon;
            const roleColor = ROLE_COLORS[role] || 'text-muted-foreground bg-muted';

            const successRate =
              (agent.metrics?.tasksCompleted || 0) + (agent.metrics?.tasksFailed || 0) > 0
                ? ((agent.metrics?.tasksCompleted || 0) /
                    ((agent.metrics?.tasksCompleted || 0) + (agent.metrics?.tasksFailed || 0))) *
                  100
                : 0;

            return (
              <Card key={agent.id} className="overflow-hidden">
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={cn('p-1.5 rounded', roleColor)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium capitalize">{role}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                          {agent.agent_id}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn('gap-1', statusConfig.color)}
                    >
                      <StatusIcon
                        className={cn(
                          'h-3 w-3',
                          agent.status === 'busy' && 'animate-spin'
                        )}
                      />
                      {agent.status}
                    </Badge>
                  </div>

                  {/* Current Task */}
                  {agent.current_subtask && (
                    <div className="mb-2 px-2 py-1 bg-muted/50 rounded text-xs">
                      <span className="text-muted-foreground">Working on: </span>
                      <span className="font-medium truncate">
                        {agent.current_subtask}
                      </span>
                    </div>
                  )}

                  {/* Metrics */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        {agent.metrics?.tasksCompleted || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <XCircle className="h-3 w-3 text-destructive" />
                        {agent.metrics?.tasksFailed || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(agent.metrics?.avgDurationMs || 0)}
                      </span>
                    </div>
                    <span>{getTimeSinceHeartbeat(agent.last_heartbeat)}</span>
                  </div>

                  {/* Success Rate */}
                  {(agent.metrics?.tasksCompleted || 0) + (agent.metrics?.tasksFailed || 0) > 0 && (
                    <div className="mt-2">
                      <Progress value={successRate} className="h-1" />
                    </div>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
