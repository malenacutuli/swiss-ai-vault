import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SwissBrAInSidebar } from './SwissBrAInSidebar';
import { SwissBrAInHome } from './SwissBrAInHome';
import { SwissBrAInExecutionView } from './SwissBrAInExecutionView';
import { SwissBrAInManagementPanel } from './SwissBrAInManagementPanel';
import { useAgentExecution } from '@/hooks/useAgentExecution';
import type { ChatMessage } from '@/hooks/useAgentExecution';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface SidebarTask {
  id: string;
  title: string;
  status: 'created' | 'planning' | 'executing' | 'waiting_user' | 'paused' | 'completed' | 'failed';
  icon?: string;
  created_at: string;
}

interface SidebarProject {
  id: string;
  name: string;
  icon?: string;
}

export function SwissBrAInLayout() {
  const { user } = useAuth();
  const [currentView, setCurrentView] = useState<'home' | 'execution'>('home');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<SidebarTask[]>([]);
  const [projects, setProjects] = useState<SidebarProject[]>([]);
  const [showManagementPanel, setShowManagementPanel] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
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
  } = useAgentExecution();

  // Fetch tasks on mount
  useEffect(() => {
    if (user?.id) {
      fetchTasks();
      fetchProjects();
    }
  }, [user?.id]);

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
        status: run.status as SidebarTask['status'],
        created_at: run.created_at,
      })) || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setProjects(data.map(p => ({
          id: p.id,
          name: p.name,
        })));
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const handleNewTask = () => {
    setCurrentView('home');
    setSelectedTaskId(null);
    setShowManagementPanel(false);
  };

  const handleTaskSelect = async (taskId: string) => {
    setSelectedTaskId(taskId);
    setCurrentView('execution');

    // Load the task details
    try {
      const { data, error } = await (supabase as any)
        .from('agent_runs')
        .select('*')
        .eq('id', taskId)
        .single();

      if (error) throw error;

      // If task has artifacts/preview, show management panel
      if ((data as any)?.artifacts?.length > 0 || (data as any)?.status === 'completed') {
        setShowManagementPanel(true);
      }
    } catch (error) {
      console.error('Error loading task:', error);
    }
  };

  const handleSubmitTask = async (prompt: string, connectorIds?: string[]) => {
    try {
      await executeTask({ prompt, task_type: 'general', params: { connectorIds } });
      setCurrentView('execution');
      setShowManagementPanel(true);

      // Refresh tasks list
      setTimeout(fetchTasks, 1000);
    } catch (error) {
      console.error('Error executing task:', error);
      toast.error('Failed to start task');
    }
  };

  const handleSendMessage = async (message: string) => {
    await sendMessage(message);
  };

  const handleStopTask = async () => {
    await stopTask();
  };

  const handleCreateProject = async () => {
    toast.info('Project creation coming soon');
  };

  // Map currentTask to execution view format
  const executionTask = currentTask ? {
    id: currentTask.id,
    title: currentTask.prompt?.substring(0, 50) || 'Task',
    prompt: currentTask.prompt || '',
    status: currentTask.status as Task['status'],
    plan_summary: currentTask.plan_summary,
    current_step: currentTask.current_step,
    total_steps: currentTask.total_steps,
    credits_used: currentTask.credits_used,
  } : null;

  return (
    <div className="flex h-screen bg-[#FAFAFA]">
      {/* Sidebar */}
      <SwissBrAInSidebar
        tasks={tasks}
        projects={projects}
        selectedTaskId={selectedTaskId}
        onNewTask={handleNewTask}
        onTaskSelect={handleTaskSelect}
        onCreateProject={handleCreateProject}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        <AnimatePresence mode="wait">
          {currentView === 'home' ? (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1"
            >
              <SwissBrAInHome
                onSubmit={handleSubmitTask}
                userName={user?.user_metadata?.full_name || user?.email?.split('@')[0]}
              />
            </motion.div>
          ) : (
            <motion.div
              key="execution"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex"
            >
              {/* Execution View */}
              <div className={showManagementPanel ? 'w-1/2' : 'flex-1'}>
                <SwissBrAInExecutionView
                  task={executionTask}
                  messages={messages as any}
                  logs={logs?.map((l: any) => typeof l === 'string' ? l : l.message || JSON.stringify(l)) || []}
                  steps={steps?.map((s: any) => ({ id: s.id, title: s.name || s.tool_name || 'Step', status: s.status, output: s.tool_output })) || []}
                  terminalLines={terminalLines?.map((t: any) => t.content || String(t)) || []}
                  thinking={thinking}
                  isExecuting={isExecuting}
                  onSendMessage={handleSendMessage}
                  onStop={handleStopTask}
                  onToggleManagementPanel={() => setShowManagementPanel(!showManagementPanel)}
                  showManagementPanel={showManagementPanel}
                />
              </div>

              {/* Management Panel */}
              {showManagementPanel && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: '50%', opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  className="border-l border-[#E5E5E5]"
                >
                  <SwissBrAInManagementPanel
                    previewUrl={previewUrl || currentTask?.preview_url}
                    projectFiles={[]}
                    isVisible={true}
                    onClose={() => setShowManagementPanel(false)}
                    onPublish={() => toast.info('Publishing coming soon')}
                    onShare={() => toast.info('Sharing coming soon')}
                  />
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
