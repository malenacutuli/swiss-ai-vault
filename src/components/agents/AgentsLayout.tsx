import { ReactNode } from 'react';
import { AgentsSidebar } from './AgentsSidebar';

interface AgentsLayoutProps {
  children: ReactNode;
  onNewTask: () => void;
  recentTasks?: Array<{
    id: string;
    prompt: string;
    status: string;
    created_at?: string;
  }>;
  onSelectTask?: (task: any) => void;
}

export function AgentsLayout({ 
  children, 
  onNewTask, 
  recentTasks = [],
  onSelectTask 
}: AgentsLayoutProps) {
  return (
    <div className="min-h-screen bg-white">
      {/* Sidebar - 280px fixed */}
      <AgentsSidebar 
        onNewTask={onNewTask}
        recentTasks={recentTasks}
        onSelectTask={onSelectTask}
      />
      
      {/* Main content area - offset by sidebar width */}
      <div className="ml-[280px] flex-1">
        {/* Content */}
        <main className="px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
