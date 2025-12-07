import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import { ProjectSetupWizard } from "@/components/projects/ProjectSetupWizard";
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
  const { t } = useTranslation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [isWizardOpen, setIsWizardOpen] = useState(false);
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

  const handleCreateProject = async (name: string, description: string) => {
    if (!name.trim()) return;
    
    const result = await createProject(name.trim(), description.trim() || undefined);
    
    if (result) {
      setIsWizardOpen(false);
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
      <h3 className="text-lg font-semibold text-foreground mb-2">{t('projects.failedToLoad')}</h3>
      <p className="text-muted-foreground mb-4">{error?.message || t('errors.unexpectedError')}</p>
      <Button onClick={refetch} variant="outline">
        {t('common.tryAgain')}
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
              <h1 className="text-2xl font-semibold text-foreground">{t('projects.title')}</h1>
              <p className="text-muted-foreground mt-1">
                {t('projects.subtitle')}
              </p>
            </div>
            <Button
              onClick={() => setIsWizardOpen(true)}
              className="bg-primary hover:bg-primary/90 gap-2"
            >
              <Plus className="h-4 w-4" />
              {t('projects.createProject')}
            </Button>
          </div>

          {/* Filter/Search Bar */}
          <div className="flex flex-col sm:flex-row gap-4 animate-fade-in animate-delay-100">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('projects.filters.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-secondary border-border"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px] bg-secondary border-border">
                <SelectValue placeholder={t('common.status')} />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">{t('projects.filters.allStatus')}</SelectItem>
                <SelectItem value="setup">{t('projects.status.setup')}</SelectItem>
                <SelectItem value="dataset">{t('projects.status.dataset')}</SelectItem>
                <SelectItem value="finetuning">{t('projects.status.finetuning')}</SelectItem>
                <SelectItem value="evaluation">{t('projects.status.evaluation')}</SelectItem>
                <SelectItem value="complete">{t('projects.status.complete')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-[160px] bg-secondary border-border">
                <SelectValue placeholder={t('projects.filters.sortBy')} />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="newest">{t('projects.filters.newest')}</SelectItem>
                <SelectItem value="oldest">{t('projects.filters.oldest')}</SelectItem>
                <SelectItem value="name-asc">{t('projects.filters.nameAsc')}</SelectItem>
                <SelectItem value="name-desc">{t('projects.filters.nameDesc')}</SelectItem>
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
              title={searchQuery || statusFilter !== "all" ? t('projects.noMatchingProjects') : t('projects.noProjectsYet')}
              subtitle={
                searchQuery || statusFilter !== "all"
                  ? t('projects.adjustFilters')
                  : t('projects.createFirstProject')
              }
              actionLabel={searchQuery || statusFilter !== "all" ? undefined : t('projects.createProject')}
              onAction={searchQuery || statusFilter !== "all" ? undefined : () => setIsWizardOpen(true)}
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
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <h3 className="font-semibold text-foreground truncate flex-1 min-w-0">
                            {project.name}
                          </h3>
                          <StatusBadge status={getStatusFromString(project.status)} />
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-4 min-h-[40px]">
                          {project.description || t('projects.noDescription')}
                        </p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                          <div className="flex items-center gap-1.5">
                            <Database className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="truncate">0 {t('projects.datasets')}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Cpu className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="truncate">0 {t('projects.models')}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{t('projects.created')} {formatDate(project.created_at)}</span>
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
                          onClick={(e: React.MouseEvent) => {
                            e.preventDefault();
                            setDeleteProjectId(project.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t('projects.deleteProject')}
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

      {/* Project Setup Wizard */}
      <ProjectSetupWizard
        open={isWizardOpen}
        onOpenChange={setIsWizardOpen}
        onComplete={handleCreateProject}
        isCreating={isCreating}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteProjectId} onOpenChange={(open) => !open && setDeleteProjectId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">{t('projects.deleteProject')}</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {t('projects.deleteWarning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary border-border text-foreground">
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? t('projects.deleting') : t('projects.deleteProject')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Projects;
