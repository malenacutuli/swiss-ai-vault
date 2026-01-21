import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PenSquare,
  Search,
  BookOpen,
  FolderPlus,
  ChevronDown,
  ChevronRight,
  Settings,
  LayoutGrid,
  Smartphone,
  Gift,
  Presentation,
  Globe,
  FileText,
  BarChart3,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  MoreHorizontal,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Task {
  id: string;
  prompt: string;
  status: 'created' | 'planning' | 'executing' | 'waiting_user' | 'paused' | 'completed' | 'failed';
  created_at: string;
  task_type?: string;
}

interface Project {
  id: string;
  name: string;
  tasks: Task[];
}

interface SwissBrAInSidebarProps {
  tasks: Task[];
  projects?: Project[];
  selectedTaskId?: string | null;
  onNewTask: () => void;
  onSelectTask: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => void;
  onNewProject?: () => void;
  onSearch?: (query: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const getTaskIcon = (task: Task) => {
  const type = task.task_type?.toLowerCase() || '';
  if (type.includes('slide') || type.includes('presentation')) return Presentation;
  if (type.includes('website') || type.includes('web')) return Globe;
  if (type.includes('research') || type.includes('report')) return FileText;
  if (type.includes('data') || type.includes('chart')) return BarChart3;
  return MessageSquare;
};

const getStatusIcon = (status: Task['status']) => {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="w-3 h-3 text-green-500" />;
    case 'failed':
      return <XCircle className="w-3 h-3 text-red-500" />;
    case 'executing':
    case 'planning':
      return <Loader2 className="w-3 h-3 text-[#D35400] animate-spin" />;
    case 'waiting_user':
    case 'paused':
      return <Clock className="w-3 h-3 text-yellow-500" />;
    default:
      return null;
  }
};

const truncatePrompt = (prompt: string, maxLength: number = 30) => {
  if (prompt.length <= maxLength) return prompt;
  return prompt.substring(0, maxLength) + '...';
};

export function SwissBrAInSidebar({
  tasks,
  projects = [],
  selectedTaskId,
  onNewTask,
  onSelectTask,
  onDeleteTask,
  onNewProject,
  onSearch,
  isCollapsed = false,
  onToggleCollapse,
}: SwissBrAInSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [tasksExpanded, setTasksExpanded] = useState(true);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);

  const filteredTasks = tasks.filter(task => 
    task.prompt.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    onSearch?.(query);
  };

  if (isCollapsed) {
    return (
      <div className="w-16 h-full bg-[#FAFAFA] border-r border-[#E5E5E5] flex flex-col items-center py-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className="mb-4"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
        <Button
          onClick={onNewTask}
          className="w-10 h-10 rounded-full bg-[#D35400] hover:bg-[#B84700] text-white p-0"
        >
          <PenSquare className="w-5 h-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-64 h-full bg-[#FAFAFA] border-r border-[#E5E5E5] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[#E5E5E5]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <img 
              src="/swissbrain-logo.svg" 
              alt="SwissBrAIn" 
              className="w-7 h-7"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <span className="font-semibold text-[#1A1A1A]">SwissBrAIn</span>
            <ChevronDown className="w-4 h-4 text-[#666666]" />
          </div>
          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleCollapse}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
            </Button>
          )}
        </div>
        
        {/* New Task Button */}
        <Button
          onClick={onNewTask}
          className="w-full bg-[#D35400] hover:bg-[#B84700] text-white rounded-lg h-10 font-medium"
        >
          <PenSquare className="w-4 h-4 mr-2" />
          New task
        </Button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto">
        {/* Search */}
        <div className="p-3">
          <button className="flex items-center gap-3 w-full px-3 py-2 text-[#666666] hover:text-[#1A1A1A] hover:bg-[#F0F0F0] rounded-lg transition-colors">
            <Search className="w-4 h-4" />
            <span className="text-sm">Search</span>
          </button>
          
          <button className="flex items-center gap-3 w-full px-3 py-2 text-[#666666] hover:text-[#1A1A1A] hover:bg-[#F0F0F0] rounded-lg transition-colors">
            <BookOpen className="w-4 h-4" />
            <span className="text-sm">Library</span>
          </button>
        </div>

        {/* Projects Section */}
        <div className="px-3 py-2">
          <button
            onClick={() => setProjectsExpanded(!projectsExpanded)}
            className="flex items-center justify-between w-full px-3 py-1.5 text-xs font-medium text-[#999999] uppercase tracking-wider hover:text-[#666666]"
          >
            <span>Projects</span>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNewProject?.();
                }}
                className="p-1 hover:bg-[#F0F0F0] rounded"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
              {projectsExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </div>
          </button>
          
          <AnimatePresence>
            {projectsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <button
                  onClick={onNewProject}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#666666] hover:text-[#1A1A1A] hover:bg-[#F0F0F0] rounded-lg transition-colors"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>New project</span>
                </button>
                
                {projects.map((project) => (
                  <button
                    key={project.id}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#666666] hover:text-[#1A1A1A] hover:bg-[#F0F0F0] rounded-lg transition-colors"
                  >
                    <span className="w-4 h-4 rounded bg-[#E5E5E5] flex items-center justify-center text-xs">
                      {project.name.charAt(0)}
                    </span>
                    <span className="truncate">{project.name}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* All Tasks Section */}
        <div className="px-3 py-2">
          <button
            onClick={() => setTasksExpanded(!tasksExpanded)}
            className="flex items-center justify-between w-full px-3 py-1.5 text-xs font-medium text-[#999999] uppercase tracking-wider hover:text-[#666666]"
          >
            <span>All tasks</span>
            <div className="flex items-center gap-1">
              <Settings className="w-3.5 h-3.5" />
              {tasksExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </div>
          </button>
          
          <AnimatePresence>
            {tasksExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-0.5 mt-1"
              >
                {filteredTasks.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-[#999999] text-center">
                    No tasks yet
                  </p>
                ) : (
                  filteredTasks.map((task) => {
                    const TaskIcon = getTaskIcon(task);
                    const isSelected = task.id === selectedTaskId;
                    const isHovered = task.id === hoveredTaskId;
                    
                    return (
                      <div
                        key={task.id}
                        className="relative"
                        onMouseEnter={() => setHoveredTaskId(task.id)}
                        onMouseLeave={() => setHoveredTaskId(null)}
                      >
                        <button
                          onClick={() => onSelectTask(task.id)}
                          className={cn(
                            "flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg transition-colors text-left",
                            isSelected 
                              ? "bg-[#D35400]/10 text-[#D35400]" 
                              : "text-[#666666] hover:text-[#1A1A1A] hover:bg-[#F0F0F0]"
                          )}
                        >
                          <TaskIcon className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate flex-1">{truncatePrompt(task.prompt)}</span>
                          {getStatusIcon(task.status)}
                        </button>
                        
                        {/* Delete button on hover */}
                        {isHovered && onDeleteTask && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-[#E5E5E5] rounded"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="w-4 h-4 text-[#999999]" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => onDeleteTask(task.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    );
                  })
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-[#E5E5E5] p-3">
        {/* Referral Section */}
        <button className="flex items-center gap-3 w-full px-3 py-2 text-[#666666] hover:text-[#1A1A1A] hover:bg-[#F0F0F0] rounded-lg transition-colors mb-2">
          <Gift className="w-4 h-4" />
          <div className="text-left">
            <p className="text-sm font-medium">Share with a friend</p>
            <p className="text-xs text-[#999999]">Get 500 credits each</p>
          </div>
        </button>
        
        {/* Bottom Icons */}
        <div className="flex items-center justify-between px-2">
          <button className="p-2 text-[#666666] hover:text-[#1A1A1A] hover:bg-[#F0F0F0] rounded-lg transition-colors">
            <Settings className="w-5 h-5" />
          </button>
          <button className="p-2 text-[#666666] hover:text-[#1A1A1A] hover:bg-[#F0F0F0] rounded-lg transition-colors">
            <LayoutGrid className="w-5 h-5" />
          </button>
          <button className="p-2 text-[#666666] hover:text-[#1A1A1A] hover:bg-[#F0F0F0] rounded-lg transition-colors">
            <Smartphone className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
