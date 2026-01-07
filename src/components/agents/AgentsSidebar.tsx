import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Library, 
  ChevronDown, 
  ChevronRight,
  Gift, 
  Folder,
  ListTodo,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { SwissFlag } from '@/components/icons/SwissFlag';

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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const taskCount = recentTasks.length;

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-screen bg-white border-r border-[#E5E5E5] flex flex-col z-40 transition-all duration-200",
      collapsed ? "w-16" : "w-[280px]"
    )}>
      {/* Logo */}
      <div className="h-14 px-4 border-b border-[#E5E5E5] flex items-center">
        <Link to="/agents" className="flex items-center">
          <SwissFlag className={cn("h-10", collapsed && "h-7")} />
        </Link>
      </div>
      
      {/* New Task Button */}
      <div className="p-4">
        <Button 
          className={cn(
            "w-full bg-[#1D4E5F] hover:bg-[#163d4a] text-white font-medium",
            collapsed && "px-0"
          )}
          onClick={onNewTask}
        >
          <Plus className="w-4 h-4" />
          {!collapsed && <span className="ml-2">New Task</span>}
        </Button>
      </div>
      
      {/* Search */}
      {!collapsed && (
        <div className="px-4 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999]" />
            <Input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-[#F8F8F8] border-[#E5E5E5] focus:border-[#1D4E5F] focus:ring-[#1D4E5F]/20"
            />
          </div>
        </div>
      )}
      
      {/* Divider */}
      <div className="mx-4 border-t border-[#E5E5E5]" />
      
      {/* Library Section */}
      {!collapsed && (
        <div className="px-4 py-4">
          <div className="flex items-center gap-2 text-[#999999] text-xs font-medium uppercase tracking-wider mb-3">
            <Library className="w-3.5 h-3.5" />
            <span>Library</span>
          </div>
          
          {/* Projects */}
          <div className="space-y-1">
            <button 
              onClick={() => setProjectsExpanded(!projectsExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[#1A1A1A] hover:bg-[#F5F5F5] transition-colors"
            >
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-[#666666]" />
                <span className="text-sm font-medium">Projects</span>
              </div>
              {projectsExpanded ? (
                <ChevronDown className="w-4 h-4 text-[#999999]" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[#999999]" />
              )}
            </button>
            
            {projectsExpanded && (
              <div className="ml-6 py-1">
                <button className="text-sm text-[#1D4E5F] hover:text-[#163d4a] flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Project</span>
                </button>
              </div>
            )}
          </div>
          
          {/* All Tasks */}
          <button 
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[#1A1A1A] hover:bg-[#F5F5F5] transition-colors mt-1"
          >
            <div className="flex items-center gap-2">
              <ListTodo className="w-4 h-4 text-[#666666]" />
              <span className="text-sm font-medium">All Tasks</span>
            </div>
            {taskCount > 0 && (
              <span className="text-xs bg-[#F0F0F0] text-[#666666] px-2 py-0.5 rounded-full">
                {taskCount}
              </span>
            )}
          </button>
        </div>
      )}
      
      {/* Recent Tasks */}
      {!collapsed && recentTasks.length > 0 && (
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="space-y-1">
            {recentTasks.slice(0, 10).map((task) => (
              <button
                key={task.id}
                onClick={() => onSelectTask?.(task)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-[#F5F5F5] transition-colors group"
              >
                <p className="text-[#1A1A1A] truncate text-xs leading-relaxed">{task.prompt}</p>
                <span className={cn(
                  "text-[10px] font-medium uppercase tracking-wider mt-0.5 inline-block",
                  task.status === 'completed' && "text-emerald-600",
                  task.status === 'failed' && "text-red-600",
                  task.status === 'running' && "text-blue-600",
                  task.status === 'pending' && "text-amber-600"
                )}>
                  {task.status}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Spacer */}
      <div className="flex-1" />
      
      {/* Divider */}
      <div className="mx-4 border-t border-[#E5E5E5]" />
      
      {/* Referral Banner */}
      {!collapsed && (
        <div className="p-4">
          <div className="bg-[#F8F8F8] rounded-xl p-4 border border-[#E5E5E5]">
            <div className="flex items-center gap-2 mb-2">
              <Gift className="w-4 h-4 text-[#1D4E5F]" />
              <span className="font-medium text-[#1A1A1A] text-sm">Share with a friend</span>
            </div>
            <p className="text-[#666666] text-xs">Get 500 credits each when they sign up</p>
          </div>
        </div>
      )}
      
      {/* User Profile */}
      {!collapsed && user && (
        <div className="p-4 border-t border-[#E5E5E5]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#1D4E5F] flex items-center justify-center text-white font-medium text-sm">
              {user.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#1A1A1A] truncate">
                {user.user_metadata?.full_name || 'User'}
              </p>
              <p className="text-xs text-[#999999] truncate">{user.email}</p>
            </div>
            <button 
              onClick={() => navigate('/settings')}
              className="p-1.5 text-[#999999] hover:text-[#1A1A1A] hover:bg-[#F5F5F5] rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
