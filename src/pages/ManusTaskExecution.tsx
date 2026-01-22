import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ManusLayout } from '@/components/manus/ManusLayout';
import { ManusChatPanel } from '@/components/manus/ManusChatPanel';
import { ManusManagementPanel } from '@/components/manus/ManusManagementPanel';
import { useAuth } from '@/contexts/AuthContext';
import { useAgentExecution } from '@/hooks/useAgentExecution';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  status: 'created' | 'planning' | 'executing' | 'waiting_user' | 'paused' | 'completed' | 'failed';
  icon?: string;
}

export function ManusTaskExecution() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [showManagementPanel, setShowManagementPanel] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);

  const {
    isExecuting,
    task: currentTask,
    logs,
    steps,
    messages,
    executeTask,
    sendMessage,
    stopTask,
    terminalLines,
    previewUrl,
    currentPhase,
    thinking,
    loadTask,
  } = useAgentExecution();

  // Load task on mount
  useEffect(() => {
    if (taskId && user?.id) {
      loadTask(taskId);
      fetchTasks();
    }
  }, [taskId, user?.id]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  const fetchTasks = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('agent_runs')
        .select('id, prompt, status, created_at')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setTasks((data as any[])?.map((run: any) => ({
        id: run.id,
        title: run.prompt?.substring(0, 50) + (run.prompt?.length > 50 ? '...' : ''),
        status: run.status as Task['status'],
      })) || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const handleSendMessage = async (message: string) => {
    await sendMessage(message);
  };

  const handleStopTask = async () => {
    await stopTask();
    toast({
      title: "Task stopped",
      description: "The task has been paused",
    });
  };

  const handleResumeTask = async () => {
    // Resume functionality - send empty message to continue
    await sendMessage('');
    toast({
      title: "Task resumed",
      description: "The task is continuing execution",
    });
  };

  const handleTaskSelect = (selectedTaskId: string) => {
    navigate(`/task/${selectedTaskId}`);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Map currentTask to the format expected by ManusChatPanel
  const executionTask = currentTask ? {
    id: currentTask.id,
    title: currentTask.prompt?.substring(0, 50) || 'Task',
    prompt: currentTask.prompt || '',
    status: currentTask.status as Task['status'],
    plan_summary: currentTask.plan_summary,
    current_phase: currentTask.current_step,
    total_phases: currentTask.total_steps,
    credits_used: currentTask.credits_used,
  } : null;

  return (
    <ManusLayout
      tasks={tasks}
      selectedTaskId={taskId}
      onNewTask={() => navigate('/')}
      onTaskSelect={handleTaskSelect}
    >
      <div className="flex-1 flex h-full">
        {/* Chat Panel */}
        <div className={showManagementPanel ? 'w-1/2' : 'flex-1'}>
          <ManusChatPanel
            task={executionTask}
            messages={messages}
            logs={logs}
            steps={steps}
            terminalLines={terminalLines?.map((t: any) => t.content || String(t)) || []}
            thinking={thinking}
            isExecuting={isExecuting}
            onSendMessage={handleSendMessage}
            onStop={handleStopTask}
            onResume={handleResumeTask}
            onToggleManagementPanel={() => setShowManagementPanel(!showManagementPanel)}
            showManagementPanel={showManagementPanel}
          />
        </div>

        {/* Management Panel */}
        <AnimatePresence>
          {showManagementPanel && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '50%', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-l border-[#E5E5E5] bg-white"
            >
              <ManusManagementPanel
                previewUrl={previewUrl || currentTask?.preview_url}
                projectFiles={[]}
                isVisible={true}
                onClose={() => setShowManagementPanel(false)}
                taskId={taskId}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ManusLayout>
  );
}

export default ManusTaskExecution;
