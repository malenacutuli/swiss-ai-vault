import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useModels, useUpdateModel, useDeleteModel } from "@/hooks/useSupabase";
import { supabase } from "@/integrations/supabase/client";
import {
  Cpu,
  Play,
  Download,
  Cloud,
  CloudOff,
  MoreHorizontal,
  Copy,
  Trash2,
  ExternalLink,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useToast } from "@/hooks/use-toast";

const Models = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [deleteModelId, setDeleteModelId] = useState<string | null>(null);
  const [deployingModelId, setDeployingModelId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const { models, loading, error, refetch } = useModels();
  const { updateModel } = useUpdateModel();
  const { deleteModel, loading: deleteLoading } = useDeleteModel();

  // Subscribe to real-time model updates
  useEffect(() => {
    const channel = supabase
      .channel('models-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'models',
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatParameterCount = (count: number | null) => {
    if (!count) return 'Unknown';
    if (count >= 1e9) return `${(count / 1e9).toFixed(1)}B`;
    if (count >= 1e6) return `${(count / 1e6).toFixed(1)}M`;
    return count.toString();
  };

  const copyModelId = (modelId: string) => {
    navigator.clipboard.writeText(modelId);
    toast({
      title: 'Copied',
      description: 'Model ID copied to clipboard',
    });
  };

  const handleToggleDeploy = async (modelId: string, currentlyDeployed: boolean) => {
    setDeployingModelId(modelId);
    await updateModel(modelId, { is_deployed: !currentlyDeployed });
    setDeployingModelId(null);
  };

  const handleDeleteModel = async () => {
    if (!deleteModelId) return;
    const success = await deleteModel(deleteModelId);
    if (success) {
      refetch();
    }
    setDeleteModelId(null);
  };

  const handleTestModel = (modelId: string) => {
    navigate(`/playground?model=${modelId}`);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Error loading models</p>
          <Button onClick={() => refetch()}>Retry</Button>
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
              <h1 className="text-2xl font-semibold text-foreground">Models</h1>
              <p className="text-muted-foreground mt-1">
                Manage and deploy your fine-tuned models
              </p>
            </div>
          </div>

          {/* Models Grid */}
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-9 w-9 rounded-lg" />
                        <div>
                          <Skeleton className="h-5 w-32 mb-1" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-4 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : models.length === 0 ? (
            <EmptyState
              icon={Cpu}
              title="No models yet"
              subtitle="Complete a fine-tuning job to create your first model"
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {models.map((model, index) => (
                <Card
                  key={model.id}
                  className="bg-card border-border animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Cpu className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{model.name}</h3>
                          <p className="text-xs text-muted-foreground">{model.base_model}</p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          <DropdownMenuItem onClick={() => copyModelId(model.model_id)} className="cursor-pointer">
                            <Copy className="mr-2 h-4 w-4" />
                            Copy Model ID
                          </DropdownMenuItem>
                          {model.finetuning_job_id && (
                            <DropdownMenuItem 
                              onClick={() => navigate(`/finetuning?job=${model.finetuning_job_id}`)} 
                              className="cursor-pointer"
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              View Fine-tuning Job
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="cursor-pointer">
                            <Download className="mr-2 h-4 w-4" />
                            Download Checkpoint
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => setDeleteModelId(model.id)}
                            className="cursor-pointer text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {model.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {model.description}
                      </p>
                    )}

                    {/* Model ID */}
                    <div className="flex items-center gap-2 p-2 rounded bg-secondary">
                      <code className="text-xs text-muted-foreground flex-1 truncate font-mono">
                        {model.model_id}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyModelId(model.model_id)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground">
                        {formatParameterCount(model.parameter_count)} params
                      </span>
                      {model.context_length && (
                        <span className="text-muted-foreground">
                          {(model.context_length / 1000).toFixed(0)}K context
                        </span>
                      )}
                    </div>

                    {/* Deployment Status */}
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <button
                        onClick={() => handleToggleDeploy(model.id, model.is_deployed ?? false)}
                        disabled={deployingModelId === model.id}
                        className="flex items-center gap-2 hover:opacity-80 transition-opacity disabled:opacity-50"
                      >
                        {deployingModelId === model.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : model.is_deployed ? (
                          <>
                            <Cloud className="h-4 w-4 text-success" />
                            <span className="text-sm text-success">Deployed</span>
                          </>
                        ) : (
                          <>
                            <CloudOff className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Not deployed</span>
                          </>
                        )}
                      </button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-1 border-border"
                        onClick={() => handleTestModel(model.model_id)}
                      >
                        <Play className="h-3 w-3" />
                        Test
                      </Button>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Created {formatDate(model.created_at)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteModelId} onOpenChange={() => setDeleteModelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Model</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this model? This action cannot be undone.
              Any deployments using this model will be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteModel}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Models;
