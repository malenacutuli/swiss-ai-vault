import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  PanelLeftClose,
  PanelLeft,
  Edit3,
  Search,
  BookOpen,
  Plus,
  FolderOpen,
  SlidersHorizontal,
  Settings,
  LayoutGrid,
  Smartphone,
  ChevronRight,
  Users,
  Star,
  Gem,
  Presentation,
  Gift,
  Code,
  Globe,
  FileText,
  Palette,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SwissFlag } from "@/components/icons/SwissFlag";

// Task status types matching Manus.im
type TaskStatus = "created" | "planning" | "executing" | "waiting_user" | "paused" | "completed" | "failed";

interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  icon?: string;
}

interface Project {
  id: string;
  name: string;
  icon?: string;
}

interface ManusSidebarProps {
  tasks?: Task[];
  projects?: Project[];
  selectedTaskId?: string | null;
  onNewTask?: () => void;
  onTaskSelect?: (taskId: string) => void;
  onCreateProject?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

// Status dot colors matching Manus.im exactly
const statusColors: Record<string, string> = {
  created: "bg-gray-400",
  planning: "bg-blue-500",
  executing: "bg-amber-500",
  waiting_user: "bg-purple-500",
  paused: "bg-purple-500",
  completed: "bg-green-500",
  failed: "bg-red-500",
};

// Task icons (Lucide) based on task type
const getTaskIcon = (title: string): LucideIcon => {
  const lower = title.toLowerCase();
  if (lower.includes("learning") || lower.includes("genspark")) return Star;
  if (lower.includes("product") || lower.includes("packaging")) return Gem;
  if (lower.includes("presentation") || lower.includes("slides")) return Presentation;
  if (lower.includes("invitación") || lower.includes("cumpleaños")) return Gift;
  if (lower.includes("developing") || lower.includes("agentic") || lower.includes("code")) return Code;
  if (lower.includes("website") || lower.includes("web")) return Globe;
  if (lower.includes("research") || lower.includes("search")) return Search;
  if (lower.includes("document") || lower.includes("doc")) return FileText;
  if (lower.includes("image") || lower.includes("design")) return Palette;
  return ClipboardList;
};

export function ManusSidebar({
  tasks = [],
  projects = [],
  selectedTaskId,
  onNewTask,
  onTaskSelect,
  onCreateProject,
  isCollapsed = false,
  onToggleCollapse,
}: ManusSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  // Demo tasks if no real tasks
  const demoTasks: Task[] = [
    { id: "demo-1", title: "Learning from genspark.ai", status: "executing" },
    { id: "demo-2", title: "Product Concept and Packaging...", status: "paused" },
    { id: "demo-3", title: "Create Spanish Presentation Usi...", status: "executing" },
    { id: "demo-4", title: "Invitación de cumpleaños para ...", status: "executing" },
    { id: "demo-5", title: "Developing Agentic Actions with...", status: "completed" },
  ];

  const displayTasks = tasks.length > 0 ? tasks : demoTasks;

  if (isCollapsed) {
    return (
      <div className="w-16 h-screen bg-white border-r border-[#E5E5E5] flex flex-col items-center py-4">
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-lg hover:bg-gray-100 mb-4"
        >
          <PanelLeft className="w-5 h-5 text-[#1D4E5F]" strokeWidth={1.25} />
        </button>
        <button
          onClick={onNewTask}
          className="p-2 rounded-lg hover:bg-gray-100 mb-2"
        >
          <Edit3 className="w-5 h-5 text-[#1D4E5F]" strokeWidth={1.25} />
        </button>
        <button 
          onClick={() => navigate('/search')}
          className="p-2 rounded-lg hover:bg-gray-100 mb-2"
        >
          <Search className="w-5 h-5 text-[#1D4E5F]" strokeWidth={1.25} />
        </button>
        <button 
          onClick={() => navigate('/library')}
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          <BookOpen className="w-5 h-5 text-[#1D4E5F]" strokeWidth={1.25} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-[280px] h-screen bg-white border-r border-[#E5E5E5] flex flex-col">
      {/* Header - Logo and Collapse */}
      <div className="flex items-center justify-between px-4 py-4">
        <button onClick={() => navigate('/')} className="flex items-center">
          <SwissFlag className="h-8" />
        </button>
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg hover:bg-gray-100"
        >
          <PanelLeftClose className="w-5 h-5 text-[#1D4E5F]" strokeWidth={1.25} />
        </button>
      </div>

      {/* Navigation */}
      <div className="px-3 space-y-1">
        {/* New Task */}
        <button
          onClick={onNewTask}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 text-left"
        >
          <Edit3 className="w-5 h-5 text-[#1D4E5F]" strokeWidth={1.25} />
          <span className="text-sm font-medium text-[#1D4E5F]">New task</span>
        </button>

        {/* Search */}
        <button
          onClick={() => navigate('/search')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 text-left",
            location.pathname === "/search" && "bg-gray-100"
          )}
        >
          <Search className="w-5 h-5 text-[#1D4E5F]" strokeWidth={1.25} />
          <span className="text-sm font-medium text-[#1D4E5F]">Search</span>
        </button>

        {/* Library */}
        <button
          onClick={() => navigate('/library')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 text-left",
            location.pathname === "/library" && "bg-gray-100"
          )}
        >
          <BookOpen className="w-5 h-5 text-[#1D4E5F]" strokeWidth={1.25} />
          <span className="text-sm font-medium text-[#1D4E5F]">Library</span>
        </button>
      </div>

      {/* Projects Section */}
      <div className="px-3 mt-6">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs font-medium text-[#3A7A8C] uppercase tracking-wider">Projects</span>
          <button onClick={onCreateProject} className="p-1 rounded hover:bg-gray-100">
            <Plus className="w-4 h-4 text-[#1D4E5F]" strokeWidth={1.25} />
          </button>
        </div>
        {projects.length > 0 ? (
          projects.map((project) => (
            <button
              key={project.id}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 text-left"
            >
              <FolderOpen className="w-5 h-5 text-[#1D4E5F]" strokeWidth={1.25} />
              <span className="text-sm text-[#1D4E5F] truncate">{project.name}</span>
            </button>
          ))
        ) : (
          <button 
            onClick={onCreateProject}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 text-left"
          >
            <FolderOpen className="w-5 h-5 text-[#1D4E5F]" strokeWidth={1.25} />
            <span className="text-sm text-[#1D4E5F]">New project</span>
          </button>
        )}
      </div>

      {/* All Tasks Section */}
      <div className="px-3 mt-4 flex-1 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs font-medium text-[#3A7A8C] uppercase tracking-wider">All tasks</span>
          <button className="p-1 rounded hover:bg-gray-100">
            <SlidersHorizontal className="w-4 h-4 text-[#1D4E5F]" strokeWidth={1.25} />
          </button>
        </div>

        {/* Task List */}
        <ScrollArea className="flex-1">
          <div className="space-y-0.5">
            {displayTasks.map((task) => {
              const TaskIcon = getTaskIcon(task.title);
              return (
                <button
                  key={task.id}
                  onClick={() => onTaskSelect?.(task.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 text-left transition-colors",
                    selectedTaskId === task.id && "bg-gray-100"
                  )}
                >
                  <TaskIcon className="w-4 h-4 text-[#1D4E5F] flex-shrink-0" strokeWidth={1.25} />
                  <span className="text-sm text-[#1D4E5F] truncate flex-1">{task.title}</span>
                  <span className={cn("w-2 h-2 rounded-full flex-shrink-0", statusColors[task.status] || "bg-gray-400")} />
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Footer */}
      <div className="mt-auto border-t border-[#E5E5E5]">
        {/* Share Card */}
        <div className="px-3 py-3">
          <button className="w-full flex items-center gap-3 px-3 py-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
              <Users className="w-4 h-4 text-[#1D4E5F]" strokeWidth={1.25} />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-[#1D4E5F]">Share SwissBrAIn with a friend</p>
              <p className="text-xs text-[#3A7A8C]">Get 500 credits each</p>
            </div>
            <ChevronRight className="w-4 h-4 text-[#1D4E5F]" strokeWidth={1.25} />
          </button>
        </div>

        {/* Footer Icons */}
        <div className="flex items-center gap-4 px-6 py-3">
          <button 
            onClick={() => navigate('/settings')}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <SlidersHorizontal className="w-5 h-5 text-[#1D4E5F]" strokeWidth={1.25} />
          </button>
          <button className="p-2 rounded-lg hover:bg-gray-100">
            <LayoutGrid className="w-5 h-5 text-[#1D4E5F]" strokeWidth={1.25} />
          </button>
          <button className="p-2 rounded-lg hover:bg-gray-100">
            <Smartphone className="w-5 h-5 text-[#1D4E5F]" strokeWidth={1.25} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ManusSidebar;
