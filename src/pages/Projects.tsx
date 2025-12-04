import { useState } from "react";
import { Link } from "react-router-dom";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "lucide-react";

type ProjectStatus = "setup" | "dataset" | "finetuning" | "evaluation" | "complete";

interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  datasetsCount: number;
  modelsCount: number;
  createdAt: string;
}

// Mock data
const mockProjects: Project[] = [
  {
    id: "1",
    name: "Customer Support Bot",
    description: "AI assistant for handling customer inquiries and support tickets with multilingual capabilities.",
    status: "finetuning",
    datasetsCount: 3,
    modelsCount: 2,
    createdAt: "2024-01-15",
  },
  {
    id: "2",
    name: "Legal Document Analyzer",
    description: "Specialized model for analyzing contracts and legal documents.",
    status: "dataset",
    datasetsCount: 1,
    modelsCount: 0,
    createdAt: "2024-01-20",
  },
  {
    id: "3",
    name: "Sales Assistant",
    description: "AI model trained on sales conversations and product knowledge.",
    status: "complete",
    datasetsCount: 5,
    modelsCount: 3,
    createdAt: "2024-01-10",
  },
  {
    id: "4",
    name: "Code Review Helper",
    description: "Automated code review assistant for Python and TypeScript projects.",
    status: "evaluation",
    datasetsCount: 2,
    modelsCount: 1,
    createdAt: "2024-01-18",
  },
  {
    id: "5",
    name: "Medical Q&A",
    description: "Healthcare information assistant with verified medical knowledge base.",
    status: "setup",
    datasetsCount: 0,
    modelsCount: 0,
    createdAt: "2024-01-22",
  },
];

const Projects = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", description: "" });
  const [isCreating, setIsCreating] = useState(false);

  // Filter and sort projects
  const filteredProjects = mockProjects
    .filter((project) => {
      const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || project.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        default:
          return 0;
      }
    });

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) return;
    
    setIsCreating(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsCreating(false);
    setIsCreateModalOpen(false);
    setNewProject({ name: "", description: "" });
    // TODO: Add actual project creation with Supabase
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

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

          {/* Projects Grid or Empty State */}
          {filteredProjects.length === 0 ? (
            <EmptyState
              icon={FolderKanban}
              title="No projects yet"
              subtitle="Create your first project to start building AI models"
              actionLabel="Create Project"
              onAction={() => setIsCreateModalOpen(true)}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredProjects.map((project, index) => (
                <Link
                  key={project.id}
                  to={`/dashboard/projects/${project.id}`}
                  className="block animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <Card className="bg-card border-border h-full transition-all duration-200 hover:shadow-elevated hover:border-border/80 cursor-pointer">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-semibold text-foreground line-clamp-1">
                          {project.name}
                        </h3>
                        <StatusBadge status={project.status} />
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                        {project.description}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                        <div className="flex items-center gap-1">
                          <Database className="h-4 w-4" />
                          <span>{project.datasetsCount} datasets</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Cpu className="h-4 w-4" />
                          <span>{project.modelsCount} models</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>Created {formatDate(project.createdAt)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
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
    </div>
  );
};

export default Projects;
