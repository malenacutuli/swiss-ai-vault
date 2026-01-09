import { useState, useEffect, useMemo } from 'react';
import { 
  ArrowRight, 
  CheckCircle2, 
  Circle, 
  Loader2,
  XCircle,
  GitBranch
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import type { Phase, Subtask } from '@/lib/agents/multiagent';

interface TaskDependencyGraphProps {
  taskId: string;
  className?: string;
}

interface GraphNode {
  id: string;
  type: 'phase' | 'subtask';
  title: string;
  status: string;
  x: number;
  y: number;
  parentId?: string;
}

interface GraphEdge {
  from: string;
  to: string;
}

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  pending: { bg: 'bg-muted', border: 'border-muted-foreground/30', text: 'text-muted-foreground' },
  in_progress: { bg: 'bg-blue-500/10', border: 'border-blue-500', text: 'text-blue-500' },
  completed: { bg: 'bg-green-500/10', border: 'border-green-500', text: 'text-green-500' },
  failed: { bg: 'bg-destructive/10', border: 'border-destructive', text: 'text-destructive' },
};

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'in_progress':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-destructive" />;
    default:
      return <Circle className="h-4 w-4 text-muted-foreground" />;
  }
};

export function TaskDependencyGraph({ taskId, className }: TaskDependencyGraphProps) {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch plan data
  useEffect(() => {
    async function fetchPlan() {
      const { data, error } = await supabase
        .from('agent_tasks')
        .select('plan_json')
        .eq('id', taskId)
        .single();

      if (!error && data?.plan_json) {
        const planData = data.plan_json as { phases?: Phase[] };
        setPhases(planData.phases || []);
      }
      setIsLoading(false);
    }

    if (taskId) {
      fetchPlan();
    }
  }, [taskId]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!taskId) return;

    const channel = supabase
      .channel(`task-plan-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agent_tasks',
          filter: `id=eq.${taskId}`,
        },
        (payload) => {
          const planData = payload.new.plan_json as { phases?: Phase[] };
          if (planData?.phases) {
            setPhases(planData.phases);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId]);

  // Build graph data
  const { nodes, edges } = useMemo(() => {
    const graphNodes: GraphNode[] = [];
    const graphEdges: GraphEdge[] = [];

    const PHASE_SPACING = 180;
    const SUBTASK_SPACING = 80;
    const PHASE_Y = 50;
    const SUBTASK_Y = 150;

    phases.forEach((phase, phaseIndex) => {
      const phaseX = phaseIndex * PHASE_SPACING + 100;

      // Add phase node
      graphNodes.push({
        id: phase.id,
        type: 'phase',
        title: phase.title,
        status: phase.status,
        x: phaseX,
        y: PHASE_Y,
      });

      // Add dependency edges
      phase.dependencies.forEach((depId) => {
        graphEdges.push({ from: depId, to: phase.id });
      });

      // Add subtask nodes
      phase.subtasks.forEach((subtask, subtaskIndex) => {
        const subtaskX = phaseX - ((phase.subtasks.length - 1) * SUBTASK_SPACING) / 2 + subtaskIndex * SUBTASK_SPACING;

        graphNodes.push({
          id: subtask.id,
          type: 'subtask',
          title: subtask.title,
          status: subtask.status,
          x: subtaskX,
          y: SUBTASK_Y,
          parentId: phase.id,
        });

        // Edge from phase to subtask
        graphEdges.push({ from: phase.id, to: subtask.id });
      });
    });

    return { nodes: graphNodes, edges: graphEdges };
  }, [phases]);

  // Calculate SVG dimensions
  const svgWidth = Math.max(400, phases.length * 180 + 100);
  const svgHeight = 250;

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-8', className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (phases.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-8 text-muted-foreground', className)}>
        <GitBranch className="h-8 w-8 mb-2" />
        <p className="text-sm">No task plan available</p>
      </div>
    );
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <svg width={svgWidth} height={svgHeight} className="min-w-full">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill="currentColor"
              className="text-muted-foreground/50"
            />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map((edge, index) => {
          const fromNode = nodes.find((n) => n.id === edge.from);
          const toNode = nodes.find((n) => n.id === edge.to);
          if (!fromNode || !toNode) return null;

          // Determine if it's a phase-to-phase or phase-to-subtask edge
          const isPhaseToSubtask = fromNode.type === 'phase' && toNode.type === 'subtask';

          return (
            <line
              key={index}
              x1={fromNode.x}
              y1={fromNode.y + (isPhaseToSubtask ? 25 : 0)}
              x2={toNode.x}
              y2={toNode.y - (isPhaseToSubtask ? 20 : 25)}
              stroke="currentColor"
              strokeWidth={isPhaseToSubtask ? 1 : 2}
              strokeDasharray={isPhaseToSubtask ? '4,4' : undefined}
              className="text-muted-foreground/30"
              markerEnd={!isPhaseToSubtask ? 'url(#arrowhead)' : undefined}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const colors = STATUS_COLORS[node.status] || STATUS_COLORS.pending;
          const isPhase = node.type === 'phase';

          return (
            <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
              {isPhase ? (
                // Phase node (larger)
                <>
                  <rect
                    x={-60}
                    y={-25}
                    width={120}
                    height={50}
                    rx={8}
                    className={cn(colors.bg, 'stroke-2', colors.border)}
                    fill="currentColor"
                    stroke="currentColor"
                  />
                  <foreignObject x={-55} y={-20} width={110} height={40}>
                    <div className="flex flex-col items-center justify-center h-full">
                      <StatusIcon status={node.status} />
                      <span className={cn('text-xs font-medium mt-1 truncate max-w-[100px]', colors.text)}>
                        {node.title}
                      </span>
                    </div>
                  </foreignObject>
                </>
              ) : (
                // Subtask node (smaller)
                <>
                  <rect
                    x={-35}
                    y={-15}
                    width={70}
                    height={30}
                    rx={4}
                    className={cn(colors.bg, 'stroke', colors.border)}
                    fill="currentColor"
                    stroke="currentColor"
                  />
                  <foreignObject x={-32} y={-12} width={64} height={24}>
                    <div className="flex items-center justify-center gap-1 h-full">
                      <StatusIcon status={node.status} />
                      <span className={cn('text-[10px] truncate max-w-[40px]', colors.text)}>
                        {node.title}
                      </span>
                    </div>
                  </foreignObject>
                </>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 text-xs">
        {Object.entries(STATUS_COLORS).map(([status, colors]) => (
          <div key={status} className="flex items-center gap-1">
            <div className={cn('w-3 h-3 rounded', colors.bg, colors.border, 'border')} />
            <span className="capitalize">{status.replace('_', ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
