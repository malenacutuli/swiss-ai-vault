import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import {
  Plus,
  Search,
  FolderKanban,
  Database,
  Cpu,
  Calendar,
  MoreVertical,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { useProjects, useCreateProject, useDeleteProject } from "@/hooks/useSupabase";
import type { ProjectStatus } from "@/types/database";

const Projects = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", description: "" });
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);

  // Hooks for data fetching and mutations
  const { projects, loading, error, refetch } = useProjects();
  const { createProject, loading: isCreating } = useCreateProject();
  const { deleteProject, loading: isDeleting } = useDeleteProject();

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    
    return projects
      .filter((project) => {
        const matchesSearch = 
          project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (project.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
        const matchesStatus = statusFilter === "all" || project.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "newest":
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          case "oldest":
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          case "name-asc":
            return a.name.localeCompare(b.name);
          case "name-desc":
            return b.name.localeCompare(a.name);
          default:
            return 0;
        }
      });
  }, [projects, searchQuery, statusFilter, sortBy]);

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) return;
    
    const result = await createProject(newProject.name.trim(), newProject.description.trim() || undefined);
    
    if (result) {
      setIsCreateModalOpen(false);
      setNewProject({ name: "", description: "" });
      refetch();
    }
  };

  const handleDeleteProject = async () => {
    if (!deleteProjectId) return;
    
    const success = await deleteProject(deleteProjectId);
    
    if (success) {
      setDeleteProjectId(null);
      refetch();
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusFromString = (status: string | null): ProjectStatus => {
    const validStatuses: ProjectStatus[] = ['setup', 'dataset', 'finetuning', 'evaluation', 'complete'];
    if (status && validStatuses.includes(status as ProjectStatus)) {
      return status as ProjectStatus;
    }
    return 'setup';
  };

  // Loading skeleton
  const renderSkeleton = () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card key={i} className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4 mb-4" />
            <div className="flex items-center gap-4 mb-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-3 w-28" />
          </CardContent>
        </Card>
      ))}
    </div>
  );

  // Error state
  const renderError = () => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
      <h3 className="text-lg font-semibold text-foreground mb-2">Failed to load projects</h3>
      <p className="text-muted-foreground mb-4">{error?.message || "An unexpected error occurred"}</p>
      <Button onClick={refetch} variant="outline">
        Try Again
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div
        className={cn(
          "transition-all duration-300",
          sidebarCollapsed ? "ml-16" : "ml-[280px]"
        )}
      >
        <DashboardHeader sidebarCollapsed={sidebarCollapsed} />

        <main className="p-6 space-y-6">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Projects</h1>
              <p className="text-muted-foreground mt-1">
                Manage your AI model development workflows
              </p>
            </div>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-primary hover:bg-primary/90 gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Project
            </Button>
          </div>

          {/* Filter/Search Bar */}
          <div className="flex flex-col sm:flex-row gap-4 animate-fade-in animate-delay-100">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-secondary border-border"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px] bg-secondary border-border">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="setup">Setup</SelectItem>
                <SelectItem value="dataset">Dataset</SelectItem>
                <SelectItem value="finetuning">Fine-tuning</SelectItem>
                <SelectItem value="evaluation">Evaluation</SelectItem>
                <SelectItem value="complete">Complete</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-[160px] bg-secondary border-border">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="name-asc">Name A-Z</SelectItem>
                <SelectItem value="name-desc">Name Z-A</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Content Area */}
          {loading ? (
            renderSkeleton()
          ) : error ? (
            renderError()
          ) : filteredProjects.length === 0 ? (
            <EmptyState
              icon={FolderKanban}
              title={searchQuery || statusFilter !== "all" ? "No matching projects" : "No projects yet"}
              subtitle={
                searchQuery || statusFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Create your first project to start building AI models"
              }
              actionLabel={searchQuery || statusFilter !== "all" ? undefined : "Create Project"}
              onAction={searchQuery || statusFilter !== "all" ? undefined : () => setIsCreateModalOpen(true)}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredProjects.map((project, index) => (
                <div
                  key={project.id}
                  className="relative group animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <Link
                    to={`/dashboard/projects/${project.id}`}
                    className="block"
                  >
                    <Card className="bg-card border-border h-full transition-all duration-200 hover:shadow-elevated hover:border-border/80 cursor-pointer">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="font-semibold text-foreground line-clamp-1 pr-8">
                            {project.name}
                          </h3>
                          <StatusBadge status={getStatusFromString(project.status)} />
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-4 min-h-[40px]">
                          {project.description || "No description"}
                        </p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                          <div className="flex items-center gap-1">
                            <Database className="h-4 w-4" />
                            <span>0 datasets</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Cpu className="h-4 w-4" />
                            <span>0 models</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>Created {formatDate(project.created_at)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                  
                  {/* Actions Menu */}
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 bg-card/80 backdrop-blur-sm hover:bg-secondary"
                          onClick={(e) => e.preventDefault()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault();
                            setDeleteProjectId(project.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Project
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Create Project Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-foreground">Create New Project</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Start a new AI model development project
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-foreground">
                Project Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g., Customer Support Bot"
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                className="bg-secondary border-border"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newProject.name.trim()) {
                    handleCreateProject();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-foreground">
                Description
              </Label>
              <Textarea
                id="description"
                placeholder="Brief description of your project..."
                value={newProject.description}
                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                className="bg-secondary border-border min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsCreateModalOpen(false)}
              className="text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={!newProject.name.trim() || isCreating}
              className="bg-primary hover:bg-primary/90"
            >
              {isCreating ? "Creating..." : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteProjectId} onOpenChange={(open) => !open && setDeleteProjectId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete Project</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete this project? This action cannot be undone.
              All associated datasets, models, and evaluations will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary border-border text-foreground">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete Project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Projects;
