import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Brain, 
  Settings2, 
  MousePointer2, 
  Play, 
  Eye, 
  Square, 
  ChevronDown, 
  ChevronRight,
  Circle,
  CheckCircle2,
  XCircle,
  Loader2,
  Terminal,
  Code2,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

// Phase types
export type ExecutionPhase = 'idle' | 'analyzing' | 'thinking' | 'selecting' | 'executing' | 'observing' | 'completed' | 'failed' | 'stopped';

interface ThoughtEntry {
  id: string;
  type: 'reasoning' | 'tool_selection' | 'result' | 'error';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

interface ToolCall {
  name: string;
  params: Record<string, unknown>;
  result?: string;
  status: 'pending' | 'running' | 'success' | 'error';
}

interface AgentExecutionPanelProps {
  taskId: string | null;
  onStop?: () => void;
  className?: string;
}

// Phase configuration
const PHASE_CONFIG: Record<ExecutionPhase, { 
  icon: React.ComponentType<{ className?: string }>; 
  label: string; 
  color: string;
}> = {
  idle: { icon: Circle, label: 'Ready', color: 'text-[#999999]' },
  analyzing: { icon: Brain, label: 'Analyzing', color: 'text-[#1D4E5F]' },
  thinking: { icon: Settings2, label: 'Thinking', color: 'text-[#1D4E5F]' },
  selecting: { icon: MousePointer2, label: 'Selecting Tool', color: 'text-[#1D4E5F]' },
  executing: { icon: Play, label: 'Executing', color: 'text-emerald-600' },
  observing: { icon: Eye, label: 'Observing', color: 'text-[#1D4E5F]' },
  completed: { icon: CheckCircle2, label: 'Completed', color: 'text-emerald-600' },
  failed: { icon: XCircle, label: 'Failed', color: 'text-red-600' },
  stopped: { icon: Square, label: 'Stopped', color: 'text-amber-600' },
};

export function AgentExecutionPanel({ 
  taskId, 
  onStop,
  className 
}: AgentExecutionPanelProps) {
  const [phase, setPhase] = useState<ExecutionPhase>('idle');
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [thoughts, setThoughts] = useState<ThoughtEntry[]>([]);
  const [currentTool, setCurrentTool] = useState<ToolCall | null>(null);
  const [isThoughtsExpanded, setIsThoughtsExpanded] = useState(true);
  const [streamingText, setStreamingText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const thoughtsEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to real-time task updates
  useEffect(() => {
    if (!taskId) {
      setPhase('idle');
      setThoughts([]);
      setCurrentTool(null);
      return;
    }

    // Subscribe to task logs for real-time updates
    const channel = supabase
      .channel(`agent-execution-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_task_logs',
          filter: `task_id=eq.${taskId}`,
        },
        (payload) => {
          const log = payload.new as {
            id: string;
            log_type: string;
            content: string;
            metadata?: Record<string, unknown>;
            timestamp: string;
          };

          handleLogEntry(log);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agent_tasks',
          filter: `id=eq.${taskId}`,
        },
        (payload) => {
          const task = payload.new as {
            status: string;
            current_step: number;
            total_steps: number;
          };

          if (task.current_step) setCurrentStep(task.current_step);
          if (task.total_steps) setTotalSteps(task.total_steps);

          // Map task status to phase
          switch (task.status) {
            case 'completed':
              setPhase('completed');
              break;
            case 'failed':
              setPhase('failed');
              break;
            case 'running':
              // Keep current phase
              break;
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId]);

  // Handle incoming log entries
  const handleLogEntry = useCallback((log: {
    id: string;
    log_type: string;
    content: string;
    metadata?: Record<string, unknown>;
    timestamp: string;
  }) => {
    // Update phase based on log type
    switch (log.log_type) {
      case 'phase_change':
        setPhase(log.content as ExecutionPhase);
        break;
      case 'thinking':
        setPhase('thinking');
        setStreamingText(prev => prev + log.content);
        break;
      case 'reasoning':
        setThoughts(prev => [...prev, {
          id: log.id,
          type: 'reasoning',
          content: log.content,
          timestamp: new Date(log.timestamp),
          metadata: log.metadata,
        }]);
        break;
      case 'tool_select':
        setPhase('selecting');
        setCurrentTool({
          name: log.metadata?.tool_name as string || 'unknown',
          params: log.metadata?.params as Record<string, unknown> || {},
          status: 'pending',
        });
        setThoughts(prev => [...prev, {
          id: log.id,
          type: 'tool_selection',
          content: `Selected tool: ${log.metadata?.tool_name}`,
          timestamp: new Date(log.timestamp),
          metadata: log.metadata,
        }]);
        break;
      case 'tool_start':
        setPhase('executing');
        setCurrentTool(prev => prev ? { ...prev, status: 'running' } : null);
        break;
      case 'tool_complete':
        setPhase('observing');
        setCurrentTool(prev => prev ? { 
          ...prev, 
          status: 'success',
          result: log.content,
        } : null);
        setThoughts(prev => [...prev, {
          id: log.id,
          type: 'result',
          content: log.content,
          timestamp: new Date(log.timestamp),
          metadata: log.metadata,
        }]);
        break;
      case 'tool_error':
        setCurrentTool(prev => prev ? { 
          ...prev, 
          status: 'error',
          result: log.content,
        } : null);
        setThoughts(prev => [...prev, {
          id: log.id,
          type: 'error',
          content: log.content,
          timestamp: new Date(log.timestamp),
          metadata: log.metadata,
        }]);
        break;
      case 'step_complete':
        setCurrentStep(prev => prev + 1);
        setStreamingText('');
        break;
    }
  }, []);

  // Auto-scroll thoughts
  useEffect(() => {
    if (thoughtsEndRef.current) {
      thoughtsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [thoughts, streamingText]);

  // Handle stop
  const handleStop = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (taskId) {
      // Update task status to stopped
      await supabase
        .from('agent_tasks')
        .update({ status: 'stopped' })
        .eq('id', taskId);
    }

    setPhase('stopped');
    onStop?.();
  }, [taskId, onStop]);

  const PhaseIcon = PHASE_CONFIG[phase].icon;
  const isActive = phase !== 'idle' && phase !== 'completed' && phase !== 'failed' && phase !== 'stopped';

  return (
    <div className={cn(
      "bg-white border border-[#E5E5E5] rounded-xl overflow-hidden",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E5E5] bg-[#FAFAFA]">
        <div className="flex items-center gap-3">
          {/* Phase indicator */}
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg",
            isActive ? "bg-[#1D4E5F]/10" : "bg-[#F0F0F0]"
          )}>
            <PhaseIcon className={cn("w-4 h-4", PHASE_CONFIG[phase].color)} />
            <span className={cn(
              "text-sm font-medium",
              PHASE_CONFIG[phase].color
            )}>
              {PHASE_CONFIG[phase].label}
            </span>
          </div>

          {/* Connection status */}
          <div className="flex items-center gap-1.5">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isConnected ? "bg-emerald-500" : "bg-[#CCCCCC]"
            )} />
            <span className="text-xs text-[#999999]">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Step counter */}
          {totalSteps > 0 && (
            <div className="text-sm text-[#666666]">
              Step <span className="font-semibold text-[#1A1A1A]">{currentStep}</span>
              <span className="text-[#999999]"> of estimated </span>
              <span className="font-semibold text-[#1A1A1A]">{totalSteps}</span>
            </div>
          )}

          {/* Stop button */}
          {isActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleStop}
              className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
            >
              <Square className="w-3.5 h-3.5 mr-1.5 fill-current" />
              Stop
            </Button>
          )}
        </div>
      </div>

      {/* Current Tool */}
      {currentTool && (
        <div className="px-4 py-3 border-b border-[#E5E5E5] bg-[#F8FAFB]">
          <div className="flex items-center gap-2 mb-2">
            <Terminal className="w-4 h-4 text-[#1D4E5F]" />
            <span className="text-sm font-medium text-[#1A1A1A]">
              {currentTool.name}
            </span>
            <span className={cn(
              "text-xs px-2 py-0.5 rounded-full",
              currentTool.status === 'running' && "bg-blue-100 text-blue-700",
              currentTool.status === 'success' && "bg-emerald-100 text-emerald-700",
              currentTool.status === 'error' && "bg-red-100 text-red-700",
              currentTool.status === 'pending' && "bg-[#F0F0F0] text-[#666666]"
            )}>
              {currentTool.status}
            </span>
          </div>
          
          {/* Parameters */}
          {Object.keys(currentTool.params).length > 0 && (
            <pre className="text-xs font-mono bg-[#1A1A1A] text-[#E5E5E5] p-2 rounded-lg overflow-x-auto">
              {JSON.stringify(currentTool.params, null, 2)}
            </pre>
          )}

          {/* Result preview */}
          {currentTool.result && (
            <div className="mt-2">
              <div className="flex items-center gap-1.5 text-xs text-[#666666] mb-1">
                <FileText className="w-3 h-3" />
                Output
              </div>
              <pre className="text-xs font-mono bg-[#F5F5F5] text-[#4A4A4A] p-2 rounded-lg overflow-x-auto max-h-32">
                {currentTool.result.slice(0, 500)}
                {currentTool.result.length > 500 && '...'}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Thought Process */}
      <div className="border-b border-[#E5E5E5]">
        <button
          onClick={() => setIsThoughtsExpanded(!isThoughtsExpanded)}
          className="w-full flex items-center justify-between px-4 py-2 hover:bg-[#FAFAFA] transition-colors"
        >
          <div className="flex items-center gap-2">
            {isThoughtsExpanded ? (
              <ChevronDown className="w-4 h-4 text-[#999999]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-[#999999]" />
            )}
            <Brain className="w-4 h-4 text-[#1D4E5F]" />
            <span className="text-sm font-medium text-[#1A1A1A]">Thought Process</span>
            {thoughts.length > 0 && (
              <span className="text-xs bg-[#F0F0F0] text-[#666666] px-2 py-0.5 rounded-full">
                {thoughts.length}
              </span>
            )}
          </div>
        </button>

        {isThoughtsExpanded && (
          <div className="px-4 pb-4 max-h-64 overflow-y-auto">
            {thoughts.length === 0 && !streamingText ? (
              <div className="text-sm text-[#999999] italic py-2">
                Waiting for agent thoughts...
              </div>
            ) : (
              <div className="space-y-2">
                {thoughts.map((thought) => (
                  <ThoughtEntry key={thought.id} thought={thought} />
                ))}
                
                {/* Streaming text */}
                {streamingText && (
                  <div className="flex gap-2">
                    <div className="flex-shrink-0 mt-0.5">
                      <Settings2 className="w-3.5 h-3.5 text-[#1D4E5F]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[#4A4A4A] font-mono whitespace-pre-wrap">
                        {streamingText}
                        <span className="inline-block w-2 h-4 bg-[#1D4E5F] ml-0.5" />
                      </p>
                    </div>
                  </div>
                )}
                
                <div ref={thoughtsEndRef} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Phase Progress */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          {(['analyzing', 'thinking', 'selecting', 'executing', 'observing'] as ExecutionPhase[]).map((p, idx) => {
            const config = PHASE_CONFIG[p];
            const Icon = config.icon;
            const isCurrentPhase = phase === p;
            const isPastPhase = ['analyzing', 'thinking', 'selecting', 'executing', 'observing'].indexOf(phase) > idx;
            
            return (
              <div key={p} className="flex items-center flex-1">
                <div className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs",
                  isCurrentPhase && "bg-[#1D4E5F]/10 text-[#1D4E5F] font-medium",
                  isPastPhase && "text-emerald-600",
                  !isCurrentPhase && !isPastPhase && "text-[#999999]"
                )}>
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{config.label}</span>
                </div>
                {idx < 4 && (
                  <div className={cn(
                    "flex-1 h-px mx-1",
                    isPastPhase ? "bg-emerald-300" : "bg-[#E5E5E5]"
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Thought entry component
function ThoughtEntry({ thought }: { thought: ThoughtEntry }) {
  const icons = {
    reasoning: Brain,
    tool_selection: MousePointer2,
    result: CheckCircle2,
    error: XCircle,
  };
  
  const colors = {
    reasoning: 'text-[#1D4E5F]',
    tool_selection: 'text-amber-600',
    result: 'text-emerald-600',
    error: 'text-red-600',
  };

  const Icon = icons[thought.type];

  return (
    <div className="flex gap-2">
      <div className="flex-shrink-0 mt-0.5">
        <Icon className={cn("w-3.5 h-3.5", colors[thought.type])} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm whitespace-pre-wrap break-words",
          thought.type === 'error' ? "text-red-600" : "text-[#4A4A4A]",
          (thought.type === 'result' || thought.type === 'tool_selection') && "font-mono text-xs"
        )}>
          {thought.content}
        </p>
        <span className="text-[10px] text-[#999999] mt-0.5 block">
          {thought.timestamp.toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}

export default AgentExecutionPanel;
