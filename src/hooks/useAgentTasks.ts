import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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

      if (activeError) throw activeError;

      // Fetch recent completed/failed tasks
      const { data: recent, error: recentError } = await supabase
        .from('agent_tasks')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['completed', 'failed'])
        .order('completed_at', { ascending: false })
        .limit(10);

      if (recentError) throw recentError;

      setActiveTasks(active || []);
      setRecentTasks(recent || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching agent tasks:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch tasks'));
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

  return {
    activeTasks,
    recentTasks,
    activeCount,
    isLoading,
    error,
    refetch: fetchTasks,
  };
}
