import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  ChevronDown, 
  ChevronRight, 
  Plus, 
  Folder,
  FolderOpen
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  name: string;
  task_count?: number;
}

interface ProjectsListProps {
  selectedProjectId?: string | null;
  onProjectSelect?: (projectId: string | null) => void;
  onNewProject?: () => void;
}

export function ProjectsList({ 
  selectedProjectId, 
  onProjectSelect,
  onNewProject 
}: ProjectsListProps) {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(true);

  // Query projects - using a simple mock for now since projects table may not exist
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['agent-projects', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // For now, return empty array - projects feature to be implemented
      // When projects table exists:
      // const { data } = await supabase
      //   .from('agent_projects')
      //   .select('*, agent_tasks(count)')
      //   .eq('user_id', user.id)
      //   .order('created_at', { ascending: false });
      // return data || [];
      
      return [] as Project[];
    },
    enabled: !!user?.id,
  });

  return (
    <div className="space-y-1">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-gray-900 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Folder className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium">Projects</span>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="ml-4 space-y-1">
          {/* New Project Link */}
          <button
            onClick={onNewProject}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors w-full"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Project</span>
          </button>

          {/* Projects List */}
          {isLoading ? (
            <div className="px-3 py-2 text-xs text-gray-400">Loading...</div>
          ) : projects.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400">No projects yet</div>
          ) : (
            projects.map((project) => (
              <button
                key={project.id}
                onClick={() => onProjectSelect?.(project.id)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
                  selectedProjectId === project.id
                    ? "bg-teal-50 text-teal-700"
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {selectedProjectId === project.id ? (
                    <FolderOpen className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <Folder className="w-4 h-4 flex-shrink-0 text-gray-400" />
                  )}
                  <span className="truncate">{project.name}</span>
                </div>
                {project.task_count !== undefined && project.task_count > 0 && (
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {project.task_count}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
