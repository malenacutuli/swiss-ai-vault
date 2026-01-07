import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Library, Filter, ChevronDown, FolderKanban, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AgentsSidebarProps {
  collapsed?: boolean;
  onNewTask: () => void;
  recentTasks?: Array<{
    id: string;
    prompt: string;
    status: string;
    created_at?: string;
  }>;
  onSelectTask?: (task: any) => void;
}

export function AgentsSidebar({ 
  collapsed = false, 
  onNewTask, 
  recentTasks = [],
  onSelectTask
}: AgentsSidebarProps) {
  const navigate = useNavigate();
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [tasksExpanded, setTasksExpanded] = useState(true);

  // Inline Swiss flag SVG
  const SwissFlag = () => (
    <svg viewBox="0 0 32 32" className="w-5 h-5" aria-hidden="true">
      <rect width="32" height="32" rx="2" fill="#FF0000" />
      <path d="M14 8h4v16h-4z" fill="white" />
      <path d="M8 14h16v4H8z" fill="white" />
    </svg>
  );

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-screen bg-white border-r border-[#E5E5E5] flex flex-col z-40 transition-all duration-200",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Logo */}
      <div className="p-4 border-b border-[#E5E5E5]">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <SwissFlag />
          {!collapsed && (
            <span className="font-semibold text-[#1A1A1A] text-sm">SwissVault.ai</span>
          )}
        </Link>
      </div>
      
      {/* Navigation */}
      <nav className="p-2 space-y-1">
        <Button 
          variant="ghost" 
          className={cn(
            "w-full justify-start text-[#1A1A1A] hover:bg-[#F5F5F5] font-medium",
            collapsed && "justify-center px-0"
          )}
          onClick={onNewTask}
        >
          <Plus className="w-4 h-4" />
          {!collapsed && <span className="ml-2">New task</span>}
        </Button>
        
        <Button 
          variant="ghost" 
          className={cn(
            "w-full justify-start text-[#666666] hover:bg-[#F5F5F5]",
            collapsed && "justify-center px-0"
          )}
        >
          <Search className="w-4 h-4" />
          {!collapsed && <span className="ml-2">Search</span>}
        </Button>
        
        <Button 
          variant="ghost" 
          className={cn(
            "w-full justify-start text-[#666666] hover:bg-[#F5F5F5]",
            collapsed && "justify-center px-0"
          )}
        >
          <Library className="w-4 h-4" />
          {!collapsed && <span className="ml-2">Library</span>}
        </Button>
      </nav>
      
      {/* Projects Section */}
      {!collapsed && (
        <div className="px-4 py-3">
          <button 
            onClick={() => setProjectsExpanded(!projectsExpanded)}
            className="flex items-center justify-between w-full group"
          >
            <span className="text-xs font-medium text-[#999999] uppercase tracking-wider">Projects</span>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  // Add project logic
                }}
              >
                <Plus className="w-3 h-3 text-[#666666]" />
              </Button>
              <ChevronDown className={cn(
                "w-3 h-3 text-[#999999] transition-transform",
                !projectsExpanded && "-rotate-90"
              )} />
            </div>
          </button>
        </div>
      )}
      
      {/* Project List */}
      {!collapsed && projectsExpanded && (
        <div className="flex-1 overflow-y-auto px-2">
          <div className="text-center py-8 text-[#999999] text-sm">
            No projects yet
          </div>
        </div>
      )}
      
      {/* All Tasks */}
      {!collapsed && (
        <div className="border-t border-[#E5E5E5]">
          <button 
            onClick={() => setTasksExpanded(!tasksExpanded)}
            className="flex items-center justify-between w-full px-4 py-3 group"
          >
            <span className="text-xs font-medium text-[#999999] uppercase tracking-wider">All tasks</span>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  // Filter logic
                }}
              >
                <Filter className="w-3 h-3 text-[#666666]" />
              </Button>
              <ChevronDown className={cn(
                "w-3 h-3 text-[#999999] transition-transform",
                !tasksExpanded && "-rotate-90"
              )} />
            </div>
          </button>
          
          {tasksExpanded && (
            <div className="px-2 pb-2 max-h-48 overflow-y-auto">
              {recentTasks.length === 0 ? (
                <div className="text-center py-4 text-[#999999] text-sm">
                  No tasks yet
                </div>
              ) : (
                <div className="space-y-1">
                  {recentTasks.slice(0, 8).map((task) => (
                    <button
                      key={task.id}
                      onClick={() => onSelectTask?.(task)}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-[#F5F5F5] transition-colors"
                    >
                      <p className="text-[#1A1A1A] truncate text-xs">{task.prompt}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn(
                          "text-[10px] font-medium",
                          task.status === 'completed' && "text-emerald-600",
                          task.status === 'failed' && "text-red-600",
                          task.status === 'running' && "text-blue-600",
                          task.status === 'pending' && "text-amber-600"
                        )}>
                          {task.status}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Referral Card */}
      {!collapsed && (
        <div className="p-3 border-t border-[#E5E5E5]">
          <div className="bg-[#FAFAF8] rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Gift className="w-4 h-4 text-[#722F37]" />
              <span className="font-medium text-[#1A1A1A] text-sm">Share SwissVault</span>
            </div>
            <p className="text-[#666666] text-xs">Get €10 credit each referral</p>
          </div>
        </div>
      )}
    </aside>
  );
}
