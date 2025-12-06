import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useFinetuningJob, useUpdateFinetuningJob, useDeleteFinetuningJob, useModels } from "@/hooks/useSupabase";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { BASE_MODELS } from "@/types/database";
import type { FinetuningStatus, FinetuningMethod, HyperParameters } from "@/types/database";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Trash2,
  Play,
  XCircle,
  Download,
  ExternalLink,
  AlertCircle,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  Cpu,
  Database,
  Settings,
  TrendingDown,
} from "lucide-react";

interface DatasetSnapshot {
  id: string;
  name: string;
  version: number;
  row_count: number;
  train_row_count: number | null;
  val_row_count: number | null;
  dataset_id: string;
}

interface Dataset {
  id: string;
  name: string;
}

interface TrainingLossPoint {
  step: number;
  loss: number;
}

const methodColors: Record<FinetuningMethod, string> = {
  lora: "bg-info/20 text-info border-info/30",
  qlora: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  full: "bg-warning/20 text-warning border-warning/30",
};

const FinetuningJobDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<DatasetSnapshot | null>(null);
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [copied, setCopied] = useState(false);

  const { job, experiments, loading, error, refetch } = useFinetuningJob(id);
  const { updateJob, loading: isUpdating } = useUpdateFinetuningJob();
  const { deleteJob, loading: isDeleting } = useDeleteFinetuningJob();
  const { models } = useModels();

  // Find the model created from this job
  const createdModel = useMemo(() => {
    return models?.find(m => m.finetuning_job_id === id);
  }, [models, id]);

  // Fetch snapshot and dataset info
  useEffect(() => {
    const fetchSnapshotAndDataset = async () => {
      if (!job?.snapshot_id) return;
      
      const { data: snapshotData } = await supabase
        .from('dataset_snapshots')
        .select('id, name, version, row_count, train_row_count, val_row_count, dataset_id')
        .eq('id', job.snapshot_id)
        .maybeSingle();
      
      if (snapshotData) {
        setSnapshot(snapshotData);
        
        const { data: datasetData } = await supabase
          .from('datasets')
          .select('id, name')
          .eq('id', snapshotData.dataset_id)
          .maybeSingle();
        
        if (datasetData) {
          setDataset(datasetData);
        }
      }
    };

    fetchSnapshotAndDataset();
  }, [job?.snapshot_id]);

  // Parse training loss from experiments
  const trainingLossData = useMemo((): TrainingLossPoint[] => {
    if (!experiments || experiments.length === 0) return [];
    
    const latestExperiment = experiments[0];
    const trainingLoss = latestExperiment.training_loss as unknown;
    
    if (!Array.isArray(trainingLoss)) return [];
    
    return trainingLoss.map((loss, index) => ({
      step: index + 1,
      loss: typeof loss === 'number' ? loss : 0,
    }));
  }, [experiments]);

  const handleStartJob = async () => {
    if (!job) return;
    
    try {
      const { error } = await supabase.functions.invoke('start-finetuning', {
        body: { job_id: job.id }
      });
      
      if (error) throw error;
      
      toast({ title: "Training started", description: "Your fine-tuning job is now running" });
      refetch();
    } catch (err) {
      toast({
        title: "Failed to start training",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive"
      });
    }
  };

  const handleCancelJob = async () => {
    if (!job) return;
    
    await updateJob(job.id, { status: 'cancelled' as const });
    refetch();
  };

  const handleRetry = async () => {
    if (!job) return;
    
    // Reset job to pending and start again
    await updateJob(job.id, { status: 'pending' as const, error_message: null });
    refetch();
  };

  const handleDelete = async () => {
    if (!job) return;
    
    const success = await deleteJob(job.id);
    if (success) {
      navigate('/dashboard/finetuning');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (startedAt: string | null, completedAt: string | null) => {
    if (!startedAt) return '—';
    const start = new Date(startedAt);
    const end = completedAt ? new Date(completedAt) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
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

  const getProgress = () => {
    if (!job || !experiments || experiments.length === 0) return 0;
  const hyperparams = job.hyperparameters as unknown as HyperParameters | null;
    const totalSteps = (hyperparams?.epochs || 3) * 100; // Rough estimate
    const currentStep = trainingLossData.length;
    return Math.min(Math.round((currentStep / totalSteps) * 100), 99);
  };

  const getCurrentLoss = () => {
    if (trainingLossData.length === 0) return null;
    return trainingLossData[trainingLossData.length - 1].loss;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <div className={cn("transition-all duration-300", sidebarCollapsed ? "ml-16" : "ml-[280px]")}>
          <DashboardHeader sidebarCollapsed={sidebarCollapsed} />
          <main className="p-6 space-y-6">
            <Skeleton className="h-8 w-64" />
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-6">
                <Skeleton className="h-64" />
                <Skeleton className="h-96" />
              </div>
              <Skeleton className="h-80" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error || !job) {
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
              <h3 className="text-lg font-semibold text-foreground mb-2">Job not found</h3>
              <p className="text-muted-foreground mb-4">
                {error?.message || "The fine-tuning job you're looking for doesn't exist or you don't have access."}
              </p>
              <Button onClick={() => navigate('/dashboard/finetuning')} variant="outline">
                Back to Fine-tuning
              </Button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const status = getStatusFromString(job.status);
  const method = getMethodFromString(job.method);
  const hyperparams = job.hyperparameters as unknown as HyperParameters | null;
  const modelInfo = BASE_MODELS.find(m => m.id === job.base_model);
  const progress = getProgress();
  const currentLoss = getCurrentLoss();
  const apiEndpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-completions`;

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className={cn("transition-all duration-300", sidebarCollapsed ? "ml-16" : "ml-[280px]")}>
        <DashboardHeader sidebarCollapsed={sidebarCollapsed} />

        <main className="p-6 space-y-6">
          {/* Breadcrumb */}
          <Breadcrumb className="animate-fade-in">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/dashboard">Dashboard</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/dashboard/finetuning">Fine-tuning</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{job.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Header */}
          <div className="flex flex-col gap-4 animate-fade-in">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard/finetuning')}
              className="w-fit"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Fine-tuning
            </Button>
            
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Cpu className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-foreground">{job.name}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-muted-foreground">{modelInfo?.name || job.base_model}</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">{modelInfo?.parameters || ''}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={status} />
                <Badge variant="outline" className={cn("uppercase", methodColors[method])}>
                  {method}
                </Badge>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {status === "pending" && (
                <>
                  <Button onClick={handleStartJob} disabled={isUpdating}>
                    <Play className="mr-2 h-4 w-4" />
                    Start Training
                  </Button>
                  <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </>
              )}
              {(status === "queued" || status === "training") && (
                <Button variant="outline" onClick={handleCancelJob} disabled={isUpdating}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              )}
              {status === "completed" && (
                <>
                  {job.s3_checkpoint_path && (
                    <Button variant="outline">
                      <Download className="mr-2 h-4 w-4" />
                      Download Checkpoint
                    </Button>
                  )}
                  {createdModel && (
                    <Button onClick={() => navigate(`/dashboard/models/${createdModel.id}`)}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View Model
                    </Button>
                  )}
                </>
              )}
              {status === "failed" && (
                <>
                  <Button onClick={handleRetry} disabled={isUpdating}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry
                  </Button>
                  <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Error State */}
          {status === 'failed' && job.error_message && (
            <Card className="border-destructive bg-destructive/10 animate-fade-in">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <AlertCircle className="h-6 w-6 text-destructive flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-destructive mb-1">Training Failed</h3>
                    <p className="text-sm text-destructive/80 font-mono whitespace-pre-wrap">
                      {job.error_message}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Progress Section (for running jobs) */}
          {(status === 'queued' || status === 'training') && (
            <Card className="bg-card border-border animate-fade-in">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  Training in Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="text-foreground font-medium">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-3" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg bg-secondary">
                    <span className="text-xs text-muted-foreground block">Steps</span>
                    <span className="text-lg font-semibold text-foreground">
                      {trainingLossData.length}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary">
                    <span className="text-xs text-muted-foreground block">Current Loss</span>
                    <span className="text-lg font-semibold text-foreground">
                      {currentLoss?.toFixed(4) || '—'}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary">
                    <span className="text-xs text-muted-foreground block">Duration</span>
                    <span className="text-lg font-semibold text-foreground">
                      {formatDuration(job.started_at, null)}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary">
                    <span className="text-xs text-muted-foreground block">Status</span>
                    <span className="text-lg font-semibold text-foreground capitalize">
                      {status}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-3 animate-fade-in animate-delay-100">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Training Loss Chart */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <TrendingDown className="h-5 w-5" />
                    Training Loss
                  </CardTitle>
                  <CardDescription>Loss over training steps</CardDescription>
                </CardHeader>
                <CardContent>
                  {trainingLossData.length === 0 ? (
                    <div className="flex items-center justify-center py-12 text-muted-foreground">
                      <Database className="h-8 w-8 mr-3" />
                      <span>No training data available yet</span>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={trainingLossData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="step" 
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickLine={false}
                        />
                        <YAxis 
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickLine={false}
                          tickFormatter={(value) => value.toFixed(2)}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            color: 'hsl(var(--foreground))',
                          }}
                          formatter={(value: number) => [value.toFixed(4), 'Loss']}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="loss" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Model Output (for completed jobs) */}
              {status === 'completed' && createdModel && (
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground">Model Output</CardTitle>
                    <CardDescription>Your fine-tuned model is ready to use</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary">
                      <div>
                        <span className="text-xs text-muted-foreground block">Model ID</span>
                        <code className="text-sm font-mono text-foreground">{createdModel.model_id}</code>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(createdModel.model_id)}
                      >
                        {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    
                    <div className="bg-[#1e1e2e] rounded-lg p-4 overflow-auto">
                      <pre className="text-sm font-mono text-gray-100">
{`curl -X POST ${apiEndpoint} \\
  -H "Authorization: Bearer sv_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${createdModel.model_id}",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`}
                      </pre>
                    </div>
                    
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate(`/dashboard/models/${createdModel.id}`)}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View Model Details
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Configuration */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-4">
                      <h4 className="font-medium text-foreground">Dataset</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Dataset</span>
                          {dataset ? (
                            <Link 
                              to={`/dashboard/datasets/${dataset.id}`}
                              className="text-primary hover:underline"
                            >
                              {dataset.name}
                            </Link>
                          ) : (
                            <span className="text-foreground">—</span>
                          )}
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Snapshot</span>
                          <span className="text-foreground">
                            {snapshot ? `${snapshot.name} (v${snapshot.version})` : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Train Rows</span>
                          <span className="text-foreground">
                            {snapshot?.train_row_count?.toLocaleString() || '—'}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Val Rows</span>
                          <span className="text-foreground">
                            {snapshot?.val_row_count?.toLocaleString() || '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="font-medium text-foreground">Hyperparameters</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Epochs</span>
                          <span className="text-foreground">{hyperparams?.epochs || 3}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Batch Size</span>
                          <span className="text-foreground">{hyperparams?.batch_size || 4}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Learning Rate</span>
                          <span className="text-foreground">{hyperparams?.learning_rate || 0.0002}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Warmup Ratio</span>
                          <span className="text-foreground">{hyperparams?.warmup_ratio || 0.03}</span>
                        </div>
                        {method !== 'full' && (
                          <>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">LoRA r</span>
                              <span className="text-foreground">{hyperparams?.lora_r || 16}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">LoRA Alpha</span>
                              <span className="text-foreground">{hyperparams?.lora_alpha || 32}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Timeline Sidebar */}
            <div className="space-y-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3 py-2 border-b border-border">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                    <div className="flex-1">
                      <span className="text-sm text-muted-foreground block">Created</span>
                      <span className="text-sm text-foreground">{formatDate(job.created_at)}</span>
                    </div>
                  </div>
                  {job.started_at && (
                    <div className="flex items-center gap-3 py-2 border-b border-border">
                      <div className="w-2 h-2 rounded-full bg-info" />
                      <div className="flex-1">
                        <span className="text-sm text-muted-foreground block">Started</span>
                        <span className="text-sm text-foreground">{formatDate(job.started_at)}</span>
                      </div>
                    </div>
                  )}
                  {job.completed_at && (
                    <div className="flex items-center gap-3 py-2 border-b border-border">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        status === 'completed' ? "bg-success" : status === 'failed' ? "bg-destructive" : "bg-muted-foreground"
                      )} />
                      <div className="flex-1">
                        <span className="text-sm text-muted-foreground block">
                          {status === 'completed' ? 'Completed' : status === 'failed' ? 'Failed' : 'Ended'}
                        </span>
                        <span className="text-sm text-foreground">{formatDate(job.completed_at)}</span>
                      </div>
                    </div>
                  )}
                  {job.started_at && (
                    <div className="flex items-center gap-3 py-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <div className="flex-1">
                        <span className="text-sm text-muted-foreground block">Duration</span>
                        <span className="text-sm text-foreground font-medium">
                          {formatDuration(job.started_at, job.completed_at)}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Checkpoint Info */}
              {(job.s3_checkpoint_path || job.s3_gguf_path) && (
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground">Checkpoints</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {job.s3_checkpoint_path && (
                      <div>
                        <span className="text-xs text-muted-foreground block mb-1">Model Checkpoint</span>
                        <code className="text-xs text-muted-foreground font-mono break-all">
                          {job.s3_checkpoint_path}
                        </code>
                      </div>
                    )}
                    {job.s3_gguf_path && (
                      <div>
                        <span className="text-xs text-muted-foreground block mb-1">GGUF Export</span>
                        <code className="text-xs text-muted-foreground font-mono break-all">
                          {job.s3_gguf_path}
                        </code>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete Fine-tuning Job</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete "{job.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
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

export default FinetuningJobDetail;
