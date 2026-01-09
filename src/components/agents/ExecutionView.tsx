import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  X, 
  Check, 
  Loader2, 
  Circle,
  Terminal,
  Eye,
  ChevronDown,
  ChevronRight,
  FileText,
  Image,
  File,
  Pause,
  Square,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

interface AgentTask {
  id: string;
  prompt: string;
  status: string;
  mode?: string | null;
  task_type?: string | null;
  current_step?: number | null;
  total_steps?: number | null;
  progress?: number | null;
  created_at?: string;
  plan_json?: any;
}

interface TaskStep {
  id: string;
  step_number: number;
  title: string | null;
  description: string | null;
  status: string | null;
  step_type: string;
  started_at: string | null;
  completed_at: string | null;
  output_data?: any;
  error_message?: string | null;
}

interface TaskLog {
  id: string;
  content: string;
  log_type: string | null;
  timestamp: string;
  sequence_number: number | null;
}

interface ExecutionViewProps {
  task: AgentTask;
  onCancel: () => void;
  onPause?: () => void;
  onRetry?: () => void;
}

type TabType = 'terminal' | 'preview';

const STEP_STATUS_CONFIG: Record<string, { 
  icon: React.ComponentType<{ className?: string }>; 
  color: string;
  animate?: boolean;
}> = {
  pending: { icon: Circle, color: 'text-gray-400' },
  running: { icon: Loader2, color: 'text-teal-600', animate: true },
  in_progress: { icon: Loader2, color: 'text-teal-600', animate: true },
  completed: { icon: Check, color: 'text-teal-600' },
  failed: { icon: X, color: 'text-red-500' },
};

export function ExecutionView({ task, onCancel, onPause, onRetry }: ExecutionViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>('terminal');
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const terminalRef = useRef<HTMLDivElement>(null);
  const lastLogRef = useRef<number>(0);

  // Query task steps
  const { data: steps = [] } = useQuery({
    queryKey: ['task-steps', task.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_task_steps')
        .select('*')
        .eq('task_id', task.id)
        .order('step_number', { ascending: true });
      
      if (error) {
        console.error('[ExecutionView] Steps query error:', error);
        return [];
      }
      return (data || []) as TaskStep[];
    },
    refetchInterval: task.status === 'executing' || task.status === 'running' ? 2000 : false,
  });

  // Query terminal logs
  const { data: logs = [] } = useQuery({
    queryKey: ['task-logs', task.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_task_logs')
        .select('*')
        .eq('task_id', task.id)
        .order('sequence_number', { ascending: true });
      
      if (error) {
        console.error('[ExecutionView] Logs query error:', error);
        return [];
      }
      return (data || []) as TaskLog[];
    },
    refetchInterval: task.status === 'executing' || task.status === 'running' ? 1000 : false,
  });

  // Query outputs for preview
  const { data: outputs = [] } = useQuery({
    queryKey: ['task-outputs', task.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_outputs')
        .select('*')
        .eq('task_id', task.id)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('[ExecutionView] Outputs query error:', error);
        return [];
      }
      return data || [];
    },
    refetchInterval: task.status === 'executing' || task.status === 'running' ? 3000 : false,
  });

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current && logs.length > lastLogRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
      lastLogRef.current = logs.length;
    }
  }, [logs]);

  const toggleStepExpanded = (stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const getStepConfig = (status: string | null) => {
    return STEP_STATUS_CONFIG[status || 'pending'] || STEP_STATUS_CONFIG.pending;
  };

  const getModeLabel = () => {
    return task.mode || task.task_type || 'Task';
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext || '')) {
      return Image;
    }
    if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext || '')) {
      return FileText;
    }
    return File;
  };

  const isRunning = task.status === 'executing' || task.status === 'running';
  const isFailed = task.status === 'failed';
  const isCompleted = task.status === 'completed';

  // Generate default steps if none exist
  const displaySteps: TaskStep[] = steps.length > 0 ? steps : [
    { id: '1', step_number: 1, title: 'Analyzing request', description: null, status: isRunning ? 'running' : 'pending', step_type: 'analysis', started_at: null, completed_at: null },
    { id: '2', step_number: 2, title: 'Planning execution', description: null, status: 'pending', step_type: 'planning', started_at: null, completed_at: null },
    { id: '3', step_number: 3, title: 'Generating content', description: null, status: 'pending', step_type: 'generation', started_at: null, completed_at: null },
    { id: '4', step_number: 4, title: 'Creating output', description: null, status: 'pending', step_type: 'output', started_at: null, completed_at: null },
  ];

  return (
    <div className="h-full flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-2 h-2 rounded-full",
            isRunning && "bg-teal-500 animate-pulse",
            isCompleted && "bg-green-500",
            isFailed && "bg-red-500",
            !isRunning && !isCompleted && !isFailed && "bg-gray-400"
          )} />
          <span className="text-sm font-medium text-gray-900">
            {isRunning ? 'Executing' : isCompleted ? 'Completed' : isFailed ? 'Failed' : 'Pending'}
          </span>
          <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded uppercase tracking-wider">
            {getModeLabel()}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {isRunning && onPause && (
            <Button variant="ghost" size="sm" onClick={onPause} className="text-gray-600">
              <Pause className="w-4 h-4 mr-1" />
              Pause
            </Button>
          )}
          {isFailed && onRetry && (
            <Button variant="ghost" size="sm" onClick={onRetry} className="text-teal-600">
              <RefreshCw className="w-4 h-4 mr-1" />
              Retry
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-gray-600">
            <Square className="w-4 h-4 mr-1" />
            {isRunning ? 'Cancel' : 'Close'}
          </Button>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex-1 flex min-h-0">
        {/* LEFT PANEL - Progress */}
        <div className="w-[40%] border-r border-gray-200 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Original prompt */}
            <div className="bg-gray-50 rounded-lg p-3 border-l-2 border-teal-500">
              <p className="text-sm text-gray-700 line-clamp-3">
                "{task.prompt}"
              </p>
              {task.created_at && (
                <p className="text-xs text-gray-400 mt-2">
                  Started {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                </p>
              )}
            </div>

            {/* Steps list */}
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</h3>
              
              {displaySteps.map((step, index) => {
                const config = getStepConfig(step.status);
                const Icon = config.icon;
                const isExpanded = expandedSteps.has(step.id);
                const hasDetails = step.description || step.output_data || step.error_message;
                
                return (
                  <div key={step.id} className="group">
                    <button
                      onClick={() => hasDetails && toggleStepExpanded(step.id)}
                      disabled={!hasDetails}
                      className={cn(
                        "w-full flex items-start gap-3 p-2 rounded-lg transition-colors text-left",
                        hasDetails && "hover:bg-gray-50 cursor-pointer",
                        !hasDetails && "cursor-default"
                      )}
                    >
                      {/* Step indicator */}
                      <div className="pt-0.5">
                        <Icon className={cn(
                          "w-4 h-4",
                          config.color,
                          config.animate && "animate-spin"
                        )} />
                      </div>
                      
                      {/* Step content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-sm font-medium",
                            step.status === 'completed' ? "text-gray-900" : 
                            step.status === 'running' || step.status === 'in_progress' ? "text-teal-700" :
                            step.status === 'failed' ? "text-red-600" : "text-gray-500"
                          )}>
                            Step {step.step_number}: {step.title || step.step_type}
                          </span>
                          {hasDetails && (
                            isExpanded ? (
                              <ChevronDown className="w-3 h-3 text-gray-400" />
                            ) : (
                              <ChevronRight className="w-3 h-3 text-gray-400" />
                            )
                          )}
                        </div>
                        
                        {/* Status indicator */}
                        {step.status === 'running' || step.status === 'in_progress' ? (
                          <span className="text-xs text-teal-600">Processing...</span>
                        ) : step.status === 'failed' && step.error_message ? (
                          <span className="text-xs text-red-500 truncate block">{step.error_message}</span>
                        ) : null}
                      </div>
                    </button>
                    
                    {/* Expanded details */}
                    {isExpanded && hasDetails && (
                      <div className="ml-7 mt-1 p-2 bg-gray-50 rounded-lg text-xs text-gray-600">
                        {step.description && <p>{step.description}</p>}
                        {step.error_message && (
                          <p className="text-red-500 mt-1">{step.error_message}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Output files */}
            {outputs.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Files Created</h3>
                <div className="space-y-1">
                  {outputs.map((output: any) => {
                    const FileIcon = getFileIcon(output.file_name);
                    return (
                      <div 
                        key={output.id}
                        className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
                      >
                        <FileIcon className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-700 truncate flex-1">
                          {output.file_name}
                        </span>
                        {output.file_size_bytes && (
                          <span className="text-xs text-gray-400">
                            {(output.file_size_bytes / 1024).toFixed(1)} KB
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL - Terminal/Preview */}
        <div className="w-[60%] flex flex-col overflow-hidden">
          {/* Tab toggle */}
          <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-200 bg-gray-50">
            <button
              onClick={() => setActiveTab('terminal')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                activeTab === 'terminal'
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-200"
              )}
            >
              <Terminal className="w-4 h-4" />
              Terminal
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                activeTab === 'preview'
                  ? "bg-teal-600 text-white"
                  : "text-gray-600 hover:bg-gray-200"
              )}
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'terminal' ? (
              <div 
                ref={terminalRef}
                className="h-full bg-gray-900 overflow-y-auto p-4 font-mono text-sm"
              >
                {logs.length === 0 ? (
                  <div className="text-gray-500">
                    {isRunning ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Waiting for output...
                      </span>
                    ) : (
                      <span>No logs available</span>
                    )}
                  </div>
                ) : (
                  logs.map((log, index) => (
                    <div 
                      key={log.id || index}
                      className={cn(
                        "py-0.5",
                        log.log_type === 'error' && "text-red-400",
                        log.log_type === 'warning' && "text-yellow-400",
                        log.log_type === 'success' && "text-green-400",
                        log.log_type === 'info' && "text-blue-400",
                        !log.log_type && "text-gray-300"
                      )}
                    >
                      <span className="text-gray-500 select-none mr-2">
                        {String(index + 1).padStart(3, ' ')}
                      </span>
                      {log.content}
                    </div>
                  ))
                )}
                
                {/* Cursor */}
                {isRunning && (
                  <div className="flex items-center gap-1 text-teal-400 mt-2">
                    <span className="animate-pulse">▊</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full bg-white overflow-y-auto p-4">
                {outputs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <Eye className="w-8 h-8 mb-2" />
                    <p className="text-sm">No preview available yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {outputs.map((output: any) => (
                      <div key={output.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">{output.file_name}</span>
                          {output.download_url && (
                            <a 
                              href={output.download_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-sm text-teal-600 hover:underline"
                            >
                              Download
                            </a>
                          )}
                        </div>
                        {output.preview_url && (
                          <img 
                            src={output.preview_url} 
                            alt={output.file_name}
                            className="max-w-full rounded-lg"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
