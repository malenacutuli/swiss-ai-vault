import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface AgentTaskRequest {
  prompt: string;
  taskType?: string;
  mode?: 'agent' | 'chat' | 'adaptive';
  privacyTier?: 'ghost' | 'vault' | 'agent';
  connectors?: string[];
  templateId?: string;
  memoryContext?: string;
  thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high';
}

export interface AgentTask {
  id: string;
  prompt: string;
  status: string;
  task_type: string | null;
  mode: string | null;
  privacy_tier: string | null;
  current_step: number | null;
  total_steps: number | null;
  progress_percentage: number | null;
  plan_summary: string | null;
  result_summary: string | null;
  error_message: string | null;
  credits_used: number | null;
  tokens_used: number | null;
  duration_ms: number | null;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface AgentTaskStep {
  id: string;
  task_id: string;
  step_number: number;
  step_type: string;
  tool_name: string | null;
  description: string | null;
  status: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export function useAgentTasks() {
  const { user } = useAuth();
  const [activeTasks, setActiveTasks] = useState<AgentTask[]>([]);
  const [recentTasks, setRecentTasks] = useState<AgentTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [task, setTask] = useState<AgentTask | null>(null);
  const [showExecutionView, setShowExecutionView] = useState(false);
  const taskIdRef = useRef<string | null>(null);

  const fetchTasks = async () => {
    if (!user) {
      setActiveTasks([]);
      setRecentTasks([]);
      setIsLoading(false);
      return;
    }

    try {
      // Fetch active tasks
      const { data: active, error: activeError } = await supabase
        .from('agent_tasks')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['queued', 'planning', 'executing'])
        .order('created_at', { ascending: false });

      // Handle table not existing gracefully
      if (activeError) {
        if (activeError.code === '42P01' || activeError.message?.includes('does not exist')) {
          console.warn('[useAgentTasks] agent_tasks table not found, using empty state');
          setActiveTasks([]);
          setRecentTasks([]);
          setIsLoading(false);
          return;
        }
        throw activeError;
      }

      // Fetch recent completed/failed tasks
      const { data: recent, error: recentError } = await supabase
        .from('agent_tasks')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['completed', 'failed'])
        .order('completed_at', { ascending: false })
        .limit(10);

      if (recentError && recentError.code !== '42P01') throw recentError;

      setActiveTasks(active || []);
      setRecentTasks(recent || []);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching agent tasks:', err);
      // Don't show error toast for table not existing
      if (err?.code !== '42P01' && !err?.message?.includes('does not exist')) {
        setError(err instanceof Error ? err : new Error('Failed to fetch tasks'));
      } else {
        // Table doesn't exist - use empty state
        setActiveTasks([]);
        setRecentTasks([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [user]);

  // Set up realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('agent-tasks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_tasks',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[Agents] Realtime update:', payload);
          // Refetch on any change for simplicity
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const activeCount = activeTasks.length;

  // Execute task mutation
  const executeTask = async (request: AgentTaskRequest): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Not authenticated');
      return;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-execute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            prompt: request.prompt,
            taskType: request.taskType,
            mode: request.mode || 'agent',
            privacyTier: request.privacyTier || 'vault',
            connectors: request.connectors || [],
            templateId: request.templateId,
            memoryContext: request.memoryContext,
            thinkingLevel: request.thinkingLevel || 'high',
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed: ${response.status}`);
      }

      const data = await response.json();

      // Handle the correct response format
      // Edge function returns: { success, task: {...}, plan: {...}, output: {...} }
      // Also support legacy format: { taskId: string }
      if (!data.success) {
        throw new Error(data.error || 'Task execution failed');
      }

      // Backwards compatibility: handle both { task: {...} } and { taskId: string }
      const taskData = data.task || (data.taskId ? {
        id: data.taskId,
        status: 'processing',
        prompt: request.prompt,
        task_type: request.taskType || 'general',
        created_at: new Date().toISOString(),
      } : null);

      if (!taskData || !taskData.id) {
        throw new Error('Invalid response: missing task data');
      }

      console.log('[useAgentTasks] Task started:', taskData.id);
      
      // Set the current task for display
      setTask(taskData as AgentTask);
      taskIdRef.current = taskData.id;
      
      // Show execution view
      setShowExecutionView(true);
      
      // Refresh task lists
      await fetchTasks();
      
      toast.success('Task completed successfully');
    } catch (err) {
      console.error('[useAgentTasks] Task execution error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to execute task');
      setShowExecutionView(false);
    }
  };

  const deleteTask = async (taskId: string): Promise<boolean> => {
    if (!user) return false;
    
    try {
      // Delete related data first (in order of dependencies)
      await supabase.from('agent_reasoning').delete().eq('task_id', taskId);
      await supabase.from('agent_sources').delete().eq('task_id', taskId);
      await supabase.from('agent_communications').delete().eq('task_id', taskId);
      await supabase.from('agent_task_steps').delete().eq('task_id', taskId);
      await supabase.from('agent_memory_context').delete().eq('task_id', taskId);
      
      // Note: gemini_interactions table deletion will be added after migration
      
      // Get outputs to delete files from storage
      const { data: outputs } = await supabase
        .from('agent_outputs')
        .select('file_path')
        .eq('task_id', taskId);
      
      // Delete files from storage bucket
      if (outputs && outputs.length > 0) {
        const paths = outputs.map(o => o.file_path).filter(Boolean) as string[];
        if (paths.length > 0) {
          await supabase.storage.from('agent-outputs').remove(paths);
        }
      }
      
      // Delete output records
      await supabase.from('agent_outputs').delete().eq('task_id', taskId);
      
      // Finally delete the task
      const { error } = await supabase
        .from('agent_tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      // Refetch to update lists
      await fetchTasks();
      toast.success('Task deleted successfully');
      return true;
    } catch (err) {
      console.error('Error deleting task:', err);
      toast.error('Failed to delete task');
      return false;
    }
  };

  return {
    activeTasks,
    recentTasks,
    activeCount,
    isLoading,
    error,
    task,
    setTask,
    showExecutionView,
    setShowExecutionView,
    executeTask,
    deleteTask,
    refetch: fetchTasks,
  };
}
