import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Calendar,
  Database,
  Cpu,
  BarChart3,
  Settings,
  AlertCircle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ProjectStatus } from "@/types/database";

const ProjectDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const { data: project, isLoading, error } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      if (!id) throw new Error('Project ID is required');
      
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) throw new Error('Project not found');
      
      return data;
    },
    enabled: !!id,
  });

  const getStatusFromString = (status: string | null): ProjectStatus => {
    const validStatuses: ProjectStatus[] = ['setup', 'dataset', 'finetuning', 'evaluation', 'complete'];
    if (status && validStatuses.includes(status as ProjectStatus)) {
      return status as ProjectStatus;
    }
    return 'setup';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <div className={cn("transition-all duration-300", sidebarCollapsed ? "ml-16" : "ml-[280px]")}>
          <DashboardHeader sidebarCollapsed={sidebarCollapsed} />
          <main className="p-6 space-y-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-64 w-full" />
          </main>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <div className={cn("transition-all duration-300", sidebarCollapsed ? "ml-16" : "ml-[280px]")}>
          <DashboardHeader sidebarCollapsed={sidebarCollapsed} />
          <main className="p-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Project Not Found</h3>
              <p className="text-muted-foreground mb-4">The project you're looking for doesn't exist or you don't have access to it.</p>
              <Button onClick={() => navigate('/dashboard/projects')} variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Projects
              </Button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className={cn("transition-all duration-300", sidebarCollapsed ? "ml-16" : "ml-[280px]")}>
        <DashboardHeader sidebarCollapsed={sidebarCollapsed} />

        <main className="p-6 space-y-6">
          {/* Back Button & Header */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard/projects')}
              className="h-9 w-9"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold text-foreground">{project.name}</h1>
                <StatusBadge status={getStatusFromString(project.status)} />
              </div>
              <p className="text-muted-foreground mt-1">
                {project.description || "No description provided"}
              </p>
            </div>
          </div>

          {/* Project Info */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="font-medium text-foreground">{formatDate(project.created_at)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Database className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Datasets</p>
                    <p className="font-medium text-foreground">0</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <Cpu className="h-4 w-4 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Models</p>
                    <p className="font-medium text-foreground">0</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-500/10">
                    <BarChart3 className="h-4 w-4 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Evaluations</p>
                    <p className="font-medium text-foreground">0</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="outline">
                  <Link to="/dashboard/datasets">
                    <Database className="h-4 w-4 mr-2" />
                    Create Dataset
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/dashboard/finetuning">
                    <Cpu className="h-4 w-4 mr-2" />
                    Start Fine-tuning
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/dashboard/evaluations">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Run Evaluation
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
};

export default ProjectDetail;
