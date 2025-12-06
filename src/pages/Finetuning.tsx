import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { InsufficientCreditsModal } from "@/components/InsufficientCreditsModal";
import { cn } from "@/lib/utils";
import {
  Plus,
  SlidersHorizontal,
  Clock,
  Eye,
  Download,
  Trash2,
  Check,
  Sparkles,
  AlertCircle,
  Loader2,
  Play,
  XCircle,
} from "lucide-react";
import { 
  useFinetuningJobs, 
  useCreateFinetuningJob,
  useUpdateFinetuningJob,
  useDeleteFinetuningJob,
  useDatasets,
  useProjects,
} from "@/hooks/useSupabase";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BASE_MODELS, DEFAULT_HYPERPARAMETERS } from "@/types/database";
import type { FinetuningStatus, FinetuningMethod, HyperParameters } from "@/types/database";

const methodBadges: Record<FinetuningMethod, string> = {
  lora: "bg-info/20 text-info",
  qlora: "bg-purple-500/20 text-purple-400",
  full: "bg-warning/20 text-warning",
};

const Finetuning = () => {
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [deleteJobId, setDeleteJobId] = useState<string | null>(null);
  const [creditsModalOpen, setCreditsModalOpen] = useState(false);
  const [creditsModalData, setCreditsModalData] = useState<{ currentBalance?: number; requiredAmount?: number }>({});
  const { toast } = useToast();

  // Form state for create modal
  const [formData, setFormData] = useState({
    name: "",
    projectId: "",
    datasetId: "",
    snapshotId: "",
    baseModel: "",
    method: "lora" as FinetuningMethod,
    hyperparameters: { ...DEFAULT_HYPERPARAMETERS },
  });

  // Hooks for data fetching and mutations
  const { jobs, loading, error, refetch } = useFinetuningJobs();
  const { datasets } = useDatasets();
  const { projects } = useProjects();
  const { createJob, loading: isCreating } = useCreateFinetuningJob();
  const { updateJob, loading: isUpdating } = useUpdateFinetuningJob();
  const { deleteJob, loading: isDeleting } = useDeleteFinetuningJob();

  // Filter datasets to only show ready ones, optionally filtered by project
  const readyDatasets = useMemo(() => {
    let filtered = datasets?.filter(d => d.status === 'ready') || [];
    // If a project is selected, filter to only show datasets from that project
    if (formData.projectId && formData.projectId !== 'none') {
      filtered = filtered.filter(d => d.project_id === formData.projectId);
    }
    return filtered;
  }, [datasets, formData.projectId]);

  // Get snapshots for selected dataset (mock for now - would need separate hook)
  const [snapshots, setSnapshots] = useState<Array<{ id: string; name: string; row_count: number }>>([]);

  useEffect(() => {
    const fetchSnapshots = async () => {
      if (!formData.datasetId) {
        setSnapshots([]);
        return;
      }

      const { data } = await supabase
        .from('dataset_snapshots')
        .select('id, name, row_count')
        .eq('dataset_id', formData.datasetId)
        .order('version', { ascending: false });

      setSnapshots(data || []);
    };

    fetchSnapshots();
  }, [formData.datasetId]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const formatDuration = (startedAt: string | null, completedAt: string | null) => {
    if (!startedAt) return null;
    const start = new Date(startedAt);
    const end = completedAt ? new Date(completedAt) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const getProgressFromMetrics = (metrics: Record<string, unknown> | null, hyperparams: Record<string, unknown> | null) => {
    if (!metrics || !hyperparams) return 0;
    const currentStep = (metrics as { current_step?: number }).current_step || 0;
    const totalSteps = (metrics as { total_steps?: number }).total_steps || 100;
    return Math.min(100, Math.round((currentStep / totalSteps) * 100));
  };

  const getStatusFromString = (status: string | null): FinetuningStatus => {
    const validStatuses: FinetuningStatus[] = ['pending', 'queued', 'training', 'completed', 'failed', 'cancelled'];
    if (status && validStatuses.includes(status as FinetuningStatus)) {
      return status as FinetuningStatus;
    }
    return 'pending';
  };

  const getMethodFromString = (method: string | null): FinetuningMethod => {
    const validMethods: FinetuningMethod[] = ['full', 'lora', 'qlora'];
    if (method && validMethods.includes(method as FinetuningMethod)) {
      return method as FinetuningMethod;
    }
    return 'lora';
  };

  const handleCreateJob = async () => {
    if (!formData.name.trim() || !formData.snapshotId || !formData.baseModel) return;

    const result = await createJob(
      formData.name.trim(),
      formData.snapshotId,
      formData.baseModel,
      formData.method,
      formData.hyperparameters,
      formData.projectId || undefined
    );

    if (result) {
      resetForm();
      refetch();
    }
  };

  const handleStartJob = async (jobId: string) => {
    try {
      // Call the start-finetuning Edge Function
      const { data, error } = await supabase.functions.invoke('start-finetuning', {
        body: { job_id: jobId }
      });
      
      if (error) {
        console.error('Failed to start fine-tuning:', error);
        
        // Check for 402 insufficient credits error
        if (error.message?.includes('402') || (error as any)?.status === 402) {
          try {
            const errorData = JSON.parse(error.message || '{}');
            setCreditsModalData({
              currentBalance: errorData.current_balance,
              requiredAmount: errorData.required,
            });
          } catch {
            setCreditsModalData({});
          }
          setCreditsModalOpen(true);
          return;
        }
        
        toast({
          title: 'Failed to start job',
          description: error.message || 'An error occurred',
          variant: 'destructive',
        });
        return;
      }
      
      console.log('Fine-tuning job started:', data);
      toast({
        title: 'Job started',
        description: `Fine-tuning job has been queued. Credits charged: $${data?.credits_charged?.toFixed(2) || '0.00'}`,
      });
      refetch();
    } catch (err) {
      console.error('Error starting fine-tuning job:', err);
      toast({
        title: 'Error',
        description: 'Failed to start fine-tuning job',
        variant: 'destructive',
      });
    }
  };

  const handleCancelJob = async (jobId: string) => {
    await updateJob(jobId, { status: 'cancelled' });
    refetch();
  };

  const handleDeleteJob = async () => {
    if (!deleteJobId) return;
    const success = await deleteJob(deleteJobId);
    if (success) {
      setDeleteJobId(null);
      refetch();
    }
  };

  const resetForm = () => {
    setIsCreateModalOpen(false);
    setCreateStep(1);
    setFormData({
      name: "",
      projectId: "",
      datasetId: "",
      snapshotId: "",
      baseModel: "",
      method: "lora",
      hyperparameters: { ...DEFAULT_HYPERPARAMETERS },
    });
  };

  const canProceedStep = (step: number) => {
    switch (step) {
      case 1:
        return formData.name.trim() && formData.snapshotId;
      case 2:
        return formData.baseModel;
      case 3:
        return true;
      default:
        return true;
    }
  };

  // Get selected model info
  const selectedModelInfo = BASE_MODELS.find(m => m.id === formData.baseModel);
  const selectedDataset = datasets?.find(d => d.id === formData.datasetId);
  const selectedSnapshot = snapshots.find(s => s.id === formData.snapshotId);

  // Loading skeleton
  const renderSkeleton = () => (
    <div className="grid gap-4 md:grid-cols-2">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-5 w-20" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-16" />
            </div>
            <Skeleton className="h-2 w-full" />
            <div className="flex gap-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  // Error state
  const renderError = () => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
      <h3 className="text-lg font-semibold text-foreground mb-2">Failed to load jobs</h3>
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
              <h1 className="text-2xl font-semibold text-foreground">Fine-tuning</h1>
              <p className="text-muted-foreground mt-1">
                Train custom models with your datasets
              </p>
            </div>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-primary hover:bg-primary/90 gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Fine-tuning Job
            </Button>
          </div>

          {/* Content Area */}
          {loading ? (
            renderSkeleton()
          ) : error ? (
            renderError()
          ) : !jobs || jobs.length === 0 ? (
            <EmptyState
              icon={SlidersHorizontal}
              title="No fine-tuning jobs yet"
              subtitle="Create your first job to start training custom models"
              actionLabel="Create Job"
              onAction={() => setIsCreateModalOpen(true)}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {jobs.map((job, index) => {
                const status = getStatusFromString(job.status);
                const method = getMethodFromString(job.method);
                const trainingMetrics = job.training_metrics as Record<string, unknown> | null;
                const hyperparams = job.hyperparameters as Record<string, unknown> | null;
                const progress = getProgressFromMetrics(trainingMetrics, hyperparams);
                const duration = formatDuration(job.started_at, job.completed_at);
                const finalLoss = trainingMetrics?.final_loss as number | undefined;

                return (
                  <Card
                    key={job.id}
                    className="bg-card border-border animate-fade-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-foreground">{job.name}</h3>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {job.base_model}
                          </p>
                        </div>
                        <StatusBadge status={status} />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Model & Method */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-1 rounded-full bg-secondary text-foreground">
                          {BASE_MODELS.find(m => m.id === job.base_model)?.name || job.base_model}
                        </span>
                        <span className={cn("text-xs px-2 py-1 rounded-full uppercase", methodBadges[method])}>
                          {method}
                        </span>
                      </div>

                      {/* Progress (for training jobs) */}
                      {status === "training" && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="text-foreground font-medium">{progress}%</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                        </div>
                      )}

                      {/* Stats */}
                      <div className="flex items-center gap-4 text-sm">
                        {duration && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>{duration}</span>
                          </div>
                        )}
                        {finalLoss !== undefined && (
                          <div className="text-muted-foreground">
                            Loss: <span className="text-foreground">{finalLoss.toFixed(4)}</span>
                          </div>
                        )}
                        <div className="text-muted-foreground ml-auto">
                          {formatDate(job.created_at)}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-2 border-t border-border">
                        {status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-success hover:text-success"
                            onClick={() => handleStartJob(job.id)}
                            disabled={isUpdating}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Start
                          </Button>
                        )}
                        {(status === "queued" || status === "training") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-warning hover:text-warning"
                            onClick={() => handleCancelJob(job.id)}
                            disabled={isUpdating}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => navigate(`/dashboard/finetuning/${job.id}`)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Details
                        </Button>
                        {status === "completed" && (
                          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive ml-auto"
                          onClick={() => setDeleteJobId(job.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Create Job Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={(open) => {
        if (!open) resetForm();
        else setIsCreateModalOpen(true);
      }}>
        <DialogContent className="bg-card border-border sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Create Fine-tuning Job
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Step {createStep} of 4 -{" "}
              {createStep === 1
                ? "Select Dataset & Snapshot"
                : createStep === 2
                ? "Select Model"
                : createStep === 3
                ? "Configuration"
                : "Review & Start"}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 min-h-[300px]">
            {createStep === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-foreground">Job Name <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="e.g., customer-support-v3"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Project (optional)</Label>
                  <Select
                    value={formData.projectId || 'none'}
                    onValueChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      projectId: value === 'none' ? '' : value,
                      datasetId: '',
                      snapshotId: ''
                    }))}
                  >
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue placeholder="All projects" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="none">All projects</SelectItem>
                      {projects?.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Dataset <span className="text-destructive">*</span></Label>
                  <Select
                    value={formData.datasetId}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, datasetId: value, snapshotId: "" }))}
                  >
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue placeholder="Select a dataset" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {readyDatasets.length === 0 ? (
                        <SelectItem value="none" disabled>No ready datasets available</SelectItem>
                      ) : (
                        readyDatasets.map((dataset) => (
                          <SelectItem key={dataset.id} value={dataset.id}>
                            {dataset.name} ({dataset.row_count} rows)
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Snapshot <span className="text-destructive">*</span></Label>
                  <Select
                    value={formData.snapshotId}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, snapshotId: value }))}
                    disabled={!formData.datasetId}
                  >
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue placeholder={formData.datasetId ? "Select a snapshot" : "Select a dataset first"} />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {snapshots.length === 0 ? (
                        <SelectItem value="none" disabled>No snapshots available</SelectItem>
                      ) : (
                        snapshots.map((snapshot) => (
                          <SelectItem key={snapshot.id} value={snapshot.id}>
                            {snapshot.name} - {snapshot.row_count} rows
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {createStep === 2 && (
              <div className="grid grid-cols-3 gap-3">
                {BASE_MODELS.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => setFormData(prev => ({ ...prev, baseModel: model.id }))}
                    className={cn(
                      "flex flex-col items-start p-4 rounded-lg border transition-colors text-left",
                      formData.baseModel === model.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-muted-foreground"
                    )}
                  >
                    {model.id === 'Qwen/Qwen2.5-3B-Instruct' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-success/20 text-success mb-2">
                        <Sparkles className="h-3 w-3 inline mr-1" />
                        Recommended
                      </span>
                    )}
                    {model.gated && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-warning/20 text-warning mb-2">
                        License Required
                      </span>
                    )}
                    <span className="font-medium text-foreground">{model.name}</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      {model.parameters} params • {model.family}
                    </span>
                    {formData.baseModel === model.id && (
                      <Check className="h-4 w-4 text-primary mt-2" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {createStep === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-foreground">Training Method</Label>
                  <div className="flex gap-2">
                    {(["lora", "qlora", "full"] as const).map((method) => (
                      <Button
                        key={method}
                        type="button"
                        variant="outline"
                        onClick={() => setFormData(prev => ({ ...prev, method }))}
                        className={cn(
                          "flex-1 border-border uppercase",
                          formData.method === method && "border-primary bg-primary/10"
                        )}
                      >
                        {method}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-foreground">Batch Size</Label>
                    <Input
                      type="number"
                      value={formData.hyperparameters.batch_size}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        hyperparameters: { ...prev.hyperparameters, batch_size: parseInt(e.target.value) || 4 }
                      }))}
                      className="bg-secondary border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">Learning Rate</Label>
                    <Input
                      type="text"
                      value={formData.hyperparameters.learning_rate}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        hyperparameters: { ...prev.hyperparameters, learning_rate: parseFloat(e.target.value) || 0.0002 }
                      }))}
                      className="bg-secondary border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">Epochs</Label>
                    <Input
                      type="number"
                      value={formData.hyperparameters.epochs}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        hyperparameters: { ...prev.hyperparameters, epochs: parseInt(e.target.value) || 3 }
                      }))}
                      className="bg-secondary border-border"
                    />
                  </div>
                  {(formData.method === "lora" || formData.method === "qlora") && (
                    <div className="space-y-2">
                      <Label className="text-foreground">LoRA Rank</Label>
                      <Select
                        value={String(formData.hyperparameters.lora_r || 16)}
                        onValueChange={(value) => setFormData(prev => ({
                          ...prev,
                          hyperparameters: { ...prev.hyperparameters, lora_r: parseInt(value) }
                        }))}
                      >
                        <SelectTrigger className="bg-secondary border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover">
                          <SelectItem value="8">8</SelectItem>
                          <SelectItem value="16">16</SelectItem>
                          <SelectItem value="32">32</SelectItem>
                          <SelectItem value="64">64</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {createStep === 4 && (
              <div className="space-y-4">
                <div className="p-4 bg-secondary rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Job Name</span>
                    <span className="text-foreground">{formData.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Model</span>
                    <span className="text-foreground">{selectedModelInfo?.name || formData.baseModel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Method</span>
                    <span className="text-foreground uppercase">{formData.method}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dataset</span>
                    <span className="text-foreground">{selectedDataset?.name || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Snapshot</span>
                    <span className="text-foreground">{selectedSnapshot?.name || "—"} ({selectedSnapshot?.row_count || 0} rows)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Epochs</span>
                    <span className="text-foreground">{formData.hyperparameters.epochs}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Batch Size</span>
                    <span className="text-foreground">{formData.hyperparameters.batch_size}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className="text-foreground">Will be set to "pending"</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                if (createStep === 1) {
                  resetForm();
                } else {
                  setCreateStep(createStep - 1);
                }
              }}
              className="text-muted-foreground"
              disabled={isCreating}
            >
              {createStep === 1 ? "Cancel" : "Back"}
            </Button>
            <Button
              onClick={() => {
                if (createStep < 4) {
                  setCreateStep(createStep + 1);
                } else {
                  handleCreateJob();
                }
              }}
              disabled={!canProceedStep(createStep) || isCreating}
              className="bg-primary hover:bg-primary/90"
            >
              {createStep === 4 ? (
                isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Job"
                )
              ) : (
                "Next"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteJobId} onOpenChange={(open) => !open && setDeleteJobId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete Fine-tuning Job</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete this job? This action cannot be undone.
              All related experiments and training data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary border-border text-foreground">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteJob}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Job"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Insufficient Credits Modal */}
      <InsufficientCreditsModal
        open={creditsModalOpen}
        onClose={() => setCreditsModalOpen(false)}
        currentBalance={creditsModalData.currentBalance}
        requiredAmount={creditsModalData.requiredAmount}
      />
    </div>
  );
};

export default Finetuning;
