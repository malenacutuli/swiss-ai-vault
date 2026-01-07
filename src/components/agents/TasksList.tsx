import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  ListTodo,
  Filter,
  Check,
  ChevronDown
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type TaskStatus = 'all' | 'pending' | 'executing' | 'completed' | 'failed';

interface AgentTask {
  id: string;
  prompt: string;
  status: string;
  task_type: string | null;
  mode: string | null;
  created_at: string;
}

interface TasksListProps {
  projectId?: string | null;
  onTaskSelect?: (task: AgentTask) => void;
  selectedTaskId?: string | null;
}

const STATUS_CONFIG: Record<string, { color: string; label: string; animate?: boolean }> = {
  pending: { color: 'bg-gray-400', label: 'Pending' },
  executing: { color: 'bg-teal-500', label: 'In Progress', animate: true },
  running: { color: 'bg-teal-500', label: 'In Progress', animate: true },
  completed: { color: 'bg-green-500', label: 'Completed' },
  failed: { color: 'bg-red-500', label: 'Failed' },
};

const FILTER_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'all', label: 'All Tasks' },
  { value: 'completed', label: 'Completed' },
  { value: 'executing', label: 'In Progress' },
  { value: 'failed', label: 'Failed' },
];

export function TasksList({ projectId, onTaskSelect, selectedTaskId }: TasksListProps) {
  const { user } = useAuth();
  const [filter, setFilter] = useState<TaskStatus>('all');

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['agent-tasks', user?.id, projectId, filter],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from('agent_tasks')
        .select('id, prompt, status, task_type, mode, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      // Apply status filter
      if (filter !== 'all') {
        if (filter === 'executing') {
          query = query.in('status', ['executing', 'running', 'pending']);
        } else {
          query = query.eq('status', filter);
        }
      }

      const { data, error } = await query;
      if (error) {
        console.error('[TasksList] Query error:', error);
        return [];
      }
      return (data || []) as AgentTask[];
    },
    enabled: !!user?.id,
    refetchInterval: 5000, // Refresh every 5 seconds for live updates
  });

  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return '';
    }
  };

  const getTaskTypeLabel = (task: AgentTask) => {
    return task.mode || task.task_type || 'Task';
  };

  const currentFilter = FILTER_OPTIONS.find(f => f.value === filter) || FILTER_OPTIONS[0];

  return (
    <div className="space-y-2">
      {/* Header with filter */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <ListTodo className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-900">All Tasks</span>
          {tasks.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
              {tasks.length}
            </span>
          )}
        </div>

        {/* Filter Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors">
              <Filter className="w-3.5 h-3.5" />
              <span>{currentFilter.label}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 bg-white border border-gray-200 shadow-lg z-50">
            {FILTER_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => setFilter(option.value)}
                className={cn(
                  "flex items-center justify-between cursor-pointer",
                  filter === option.value && "bg-teal-50"
                )}
              >
                <span className={cn(
                  "text-sm",
                  filter === option.value ? "text-teal-700 font-medium" : "text-gray-700"
                )}>
                  {option.label}
                </span>
                {filter === option.value && (
                  <Check className="w-4 h-4 text-teal-700" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tasks List */}
      <div className="space-y-1 max-h-[300px] overflow-y-auto">
        {isLoading ? (
          <div className="px-3 py-4 text-center text-xs text-gray-400">
            Loading tasks...
          </div>
        ) : tasks.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-gray-400">
            {filter === 'all' ? 'No tasks yet' : `No ${currentFilter.label.toLowerCase()} tasks`}
          </div>
        ) : (
          tasks.map((task) => {
            const statusConfig = getStatusConfig(task.status);
            
            return (
              <button
                key={task.id}
                onClick={() => onTaskSelect?.(task)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg transition-colors group",
                  selectedTaskId === task.id
                    ? "bg-teal-50"
                    : "hover:bg-gray-50"
                )}
              >
                <div className="flex items-start gap-2.5">
                  {/* Status indicator */}
                  <div className="pt-1.5 flex-shrink-0">
                    <div 
                      className={cn(
                        "w-2 h-2 rounded-full",
                        statusConfig.color,
                        statusConfig.animate && "animate-pulse"
                      )} 
                    />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Title */}
                    <p className={cn(
                      "text-sm truncate leading-snug",
                      selectedTaskId === task.id ? "text-teal-700" : "text-gray-900"
                    )}>
                      {task.prompt}
                    </p>
                    
                    {/* Meta row */}
                    <div className="flex items-center gap-2 mt-1">
                      {/* Type badge */}
                      <span className="text-[10px] uppercase tracking-wider font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        {getTaskTypeLabel(task)}
                      </span>
                      
                      {/* Timestamp */}
                      <span className="text-[10px] text-gray-400">
                        {formatTimestamp(task.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
