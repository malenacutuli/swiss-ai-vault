import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ManusSidebar } from "./ManusSidebar";
import { ManusHeader } from "./ManusHeader";
import { useAuth } from "@/contexts/AuthContext";

interface Task {
  id: string;
  title: string;
  status: "created" | "planning" | "executing" | "waiting_user" | "paused" | "completed" | "failed";
  icon?: string;
}

interface Project {
  id: string;
  name: string;
  icon?: string;
}

interface ManusLayoutProps {
  children: React.ReactNode;
  tasks?: Task[];
  projects?: Project[];
  selectedTaskId?: string | null;
  onNewTask?: () => void;
  onTaskSelect?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => Promise<void>;
  credits?: number;
  notifications?: number;
}

export function ManusLayout({
  children,
  tasks = [],
  projects = [],
  selectedTaskId,
  onNewTask,
  onTaskSelect,
  onDeleteTask,
  credits,
  notifications,
}: ManusLayoutProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleNewTask = () => {
    if (onNewTask) {
      onNewTask();
    } else {
      navigate('/');
    }
  };

  const handleTaskSelect = (taskId: string) => {
    if (onTaskSelect) {
      onTaskSelect(taskId);
    } else {
      navigate(`/task/${taskId}`);
    }
  };

  const handleCreateProject = () => {
    // TODO: Implement project creation
    console.log("Create project");
  };

  return (
    <div className="flex h-screen bg-[#F5F5F5]">
      {/* Sidebar */}
      <ManusSidebar
        tasks={tasks}
        projects={projects}
        selectedTaskId={selectedTaskId}
        onNewTask={handleNewTask}
        onTaskSelect={handleTaskSelect}
        onDeleteTask={onDeleteTask}
        onCreateProject={handleCreateProject}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <ManusHeader credits={credits} notifications={notifications} />

        {/* Content Area */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export default ManusLayout;
