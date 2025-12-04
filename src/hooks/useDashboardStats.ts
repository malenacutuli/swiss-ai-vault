import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardStats {
  totalProjects: number;
  totalDatasetRows: number;
  totalModels: number;
  apiCallsThisMonth: number;
}

interface RecentActivity {
  id: string;
  action: string;
  target: string;
  time: string;
  type: 'success' | 'info' | 'warning' | 'error';
  created_at: string;
}

export function useDashboardStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalProjects: 0,
    totalDatasetRows: 0,
    totalModels: 0,
    apiCallsThisMonth: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch all stats in parallel
      const [projectsRes, datasetsRes, modelsRes, usageRes] = await Promise.all([
        // Total projects count
        supabase
          .from('projects')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
        
        // Total dataset rows
        supabase
          .from('datasets')
          .select('row_count')
          .eq('user_id', user.id),
        
        // Total models (fine-tuned only)
        supabase
          .from('models')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
        
        // API calls this month
        supabase
          .from('usage_daily')
          .select('value')
          .eq('user_id', user.id)
          .eq('metric', 'api_requests')
          .gte('date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]),
      ]);

      // Calculate totals
      const totalProjects = projectsRes.count || 0;
      
      const totalDatasetRows = datasetsRes.data?.reduce((sum, d) => sum + (d.row_count || 0), 0) || 0;
      
      const totalModels = modelsRes.count || 0;
      
      const apiCallsThisMonth = usageRes.data?.reduce((sum, u) => sum + (Number(u.value) || 0), 0) || 0;

      setStats({
        totalProjects,
        totalDatasetRows,
        totalModels,
        apiCallsThisMonth,
      });
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch stats'));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}

export function useRecentActivity() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  const fetchActivity = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch recent items from multiple tables in parallel
      const [projectsRes, datasetsRes, jobsRes, evalsRes] = await Promise.all([
        supabase
          .from('projects')
          .select('id, name, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
        
        supabase
          .from('datasets')
          .select('id, name, status, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
        
        supabase
          .from('finetuning_jobs')
          .select('id, name, status, created_at, completed_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
        
        supabase
          .from('evaluations')
          .select('id, model_id, status, created_at, completed_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      // Transform and combine activities
      const allActivities: RecentActivity[] = [];

      // Projects
      projectsRes.data?.forEach(p => {
        allActivities.push({
          id: `project-${p.id}`,
          action: 'Project created',
          target: p.name,
          time: formatTimeAgo(p.created_at),
          type: 'info',
          created_at: p.created_at,
        });
      });

      // Datasets
      datasetsRes.data?.forEach(d => {
        const isReady = d.status === 'ready';
        const isFailed = d.status === 'error';
        allActivities.push({
          id: `dataset-${d.id}`,
          action: isFailed ? 'Dataset processing failed' : isReady ? 'Dataset ready' : 'Dataset uploaded',
          target: d.name,
          time: formatTimeAgo(d.created_at),
          type: isFailed ? 'error' : isReady ? 'success' : 'info',
          created_at: d.created_at,
        });
      });

      // Fine-tuning jobs
      jobsRes.data?.forEach(j => {
        const isCompleted = j.status === 'completed';
        const isFailed = j.status === 'failed';
        const isTraining = j.status === 'training' || j.status === 'queued';
        allActivities.push({
          id: `job-${j.id}`,
          action: isCompleted ? 'Fine-tuning completed' : isFailed ? 'Fine-tuning failed' : isTraining ? 'Fine-tuning in progress' : 'Fine-tuning job created',
          target: j.name,
          time: formatTimeAgo(j.completed_at || j.created_at),
          type: isCompleted ? 'success' : isFailed ? 'error' : isTraining ? 'warning' : 'info',
          created_at: j.completed_at || j.created_at,
        });
      });

      // Evaluations
      evalsRes.data?.forEach(e => {
        const isCompleted = e.status === 'completed';
        const isFailed = e.status === 'failed';
        const isRunning = e.status === 'running';
        allActivities.push({
          id: `eval-${e.id}`,
          action: isCompleted ? 'Evaluation completed' : isFailed ? 'Evaluation failed' : isRunning ? 'Evaluation running' : 'Evaluation started',
          target: e.model_id.slice(0, 20) + (e.model_id.length > 20 ? '...' : ''),
          time: formatTimeAgo(e.completed_at || e.created_at),
          type: isCompleted ? 'success' : isFailed ? 'error' : isRunning ? 'warning' : 'info',
          created_at: e.completed_at || e.created_at,
        });
      });

      // Sort by created_at desc and take top 10
      allActivities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setActivities(allActivities.slice(0, 10));
    } catch (err) {
      console.error('Error fetching recent activity:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch activity'));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  return { activities, loading, error, refetch: fetchActivity };
}

// Format large numbers nicely
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toLocaleString();
}
