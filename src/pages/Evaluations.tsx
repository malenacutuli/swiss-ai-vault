import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { InsufficientCreditsModal } from "@/components/InsufficientCreditsModal";
import { cn } from "@/lib/utils";
import {
  Plus,
  BarChart3,
  Eye,
  Play,
  RotateCw,
  Trash2,
  Lock,
  AlertCircle,
  Loader2,
  ChevronDown,
} from "lucide-react";
import {
  useEvaluations,
  useMetrics,
  useCreateEvaluation,
  useCreateMetric,
  useDeleteMetric,
  useDeleteEvaluation,
  useStartEvaluation,
  useModels,
  useDatasets,
} from "@/hooks/useSupabase";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { EvaluationStatus } from "@/types/database";

const getScoreColor = (score: number) => {
  if (score >= 80) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-destructive";
};

// Base models available for evaluation (model_id is TEXT in database)
const BASE_EVALUATION_MODELS = [
  { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI" },
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI" },
  { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", provider: "Anthropic" },
  { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", provider: "Anthropic" },
];

const Evaluations = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isCreateEvalModalOpen, setIsCreateEvalModalOpen] = useState(false);
  const [isCreateMetricModalOpen, setIsCreateMetricModalOpen] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [deleteMetricId, setDeleteMetricId] = useState<string | null>(null);
  const [deleteEvaluationId, setDeleteEvaluationId] = useState<string | null>(null);
  const [expandedEvaluation, setExpandedEvaluation] = useState<string | null>(null);
  const [creditsModalOpen, setCreditsModalOpen] = useState(false);
  const [creditsModalData, setCreditsModalData] = useState<{ currentBalance?: number; requiredAmount?: number }>({});
  const { toast } = useToast();

  // Form state for create evaluation
  const [evalForm, setEvalForm] = useState({
    modelId: "",
    datasetId: "",
    snapshotId: "",
  });

  // Form state for create metric
  const [metricForm, setMetricForm] = useState({
    name: "",
    description: "",
    shouldRules: "",
    shouldNotRules: "",
  });

  // Snapshots for selected dataset
  const [snapshots, setSnapshots] = useState<Array<{ id: string; name: string; row_count: number }>>([]);

  // Hooks for data fetching
  const { evaluations, loading: evalsLoading, error: evalsError, refetch: refetchEvaluations } = useEvaluations();
  const { metrics, loading: metricsLoading, error: metricsError, refetch: refetchMetrics } = useMetrics();
  const { models } = useModels();
  const { datasets } = useDatasets();

  // Mutation hooks
  const { createEvaluation, loading: isCreatingEval } = useCreateEvaluation();
  const { createMetric, loading: isCreatingMetric } = useCreateMetric();
  const { deleteMetric, loading: isDeletingMetric } = useDeleteMetric();
  const { deleteEvaluation, loading: isDeletingEval } = useDeleteEvaluation();
  const { startEvaluation, loading: isStartingEval } = useStartEvaluation();
  const [startingEvalId, setStartingEvalId] = useState<string | null>(null);

  // Real-time subscription for evaluation status changes
  useEffect(() => {
    const channel = supabase
      .channel('evaluations-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'evaluations',
        },
        () => {
          refetchEvaluations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetchEvaluations]);

  // Fetch snapshots when dataset changes
  useEffect(() => {
    const fetchSnapshots = async () => {
      if (!evalForm.datasetId) {
        setSnapshots([]);
        return;
      }

      const { data } = await supabase
        .from('dataset_snapshots')
        .select('id, name, row_count')
        .eq('dataset_id', evalForm.datasetId)
        .order('version', { ascending: false });

      setSnapshots(data || []);
    };

    fetchSnapshots();
  }, [evalForm.datasetId]);

  // Filter ready datasets
  const readyDatasets = useMemo(() => 
    datasets?.filter(d => d.status === 'ready') || [], 
    [datasets]
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getStatusFromString = (status: string | null): EvaluationStatus => {
    const validStatuses: EvaluationStatus[] = ['pending', 'running', 'completed', 'failed'];
    if (status && validStatuses.includes(status as EvaluationStatus)) {
      return status as EvaluationStatus;
    }
    return 'pending';
  };

  const calculateAvgScore = (results: Record<string, unknown> | null): number | null => {
    if (!results || typeof results !== 'object') return null;
    const scores = Object.values(results)
      .filter((r): r is { average: number } => 
        typeof r === 'object' && r !== null && 'average' in r
      )
      .map(r => r.average);
    if (scores.length === 0) return null;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 100);
  };

  const getMetricNames = (metricIds: string[] | null): string[] => {
    if (!metricIds || !metrics) return [];
    return metricIds
      .map(id => metrics.find(m => m.id === id)?.name)
      .filter((name): name is string => !!name);
  };

  const handleCreateEvaluation = async () => {
    if (!evalForm.modelId || !evalForm.snapshotId || selectedMetrics.length === 0) return;

    // Pass model_id as simple string (TEXT column in database)
    const result = await createEvaluation(
      evalForm.modelId,
      evalForm.snapshotId,
      selectedMetrics
    );

    if (result) {
      setIsCreateEvalModalOpen(false);
      setEvalForm({ modelId: "", datasetId: "", snapshotId: "" });
      setSelectedMetrics([]);
      refetchEvaluations();
    }
  };

  const handleCreateMetric = async () => {
    if (!metricForm.name.trim()) return;

    const shouldRules = metricForm.shouldRules.split('\n').filter(r => r.trim());
    const shouldNotRules = metricForm.shouldNotRules.split('\n').filter(r => r.trim());

    const result = await createMetric(
      metricForm.name.trim(),
      metricForm.description.trim(),
      { should: shouldRules, should_not: shouldNotRules }
    );

    if (result) {
      setIsCreateMetricModalOpen(false);
      setMetricForm({ name: "", description: "", shouldRules: "", shouldNotRules: "" });
      refetchMetrics();
    }
  };

  const handleDeleteMetric = async () => {
    if (!deleteMetricId) return;
    const success = await deleteMetric(deleteMetricId);
    if (success) {
      setDeleteMetricId(null);
      refetchMetrics();
    }
  };

  const handleDeleteEvaluation = async () => {
    if (!deleteEvaluationId) return;
    const success = await deleteEvaluation(deleteEvaluationId);
    if (success) {
      setDeleteEvaluationId(null);
      refetchEvaluations();
    }
  };

  const handleStartEvaluation = async (evaluationId: string) => {
    setStartingEvalId(evaluationId);
    try {
      const success = await startEvaluation(evaluationId);
      if (success) {
        toast({
          title: 'Evaluation started',
          description: 'Your evaluation is now running.',
        });
        refetchEvaluations();
      }
    } catch (err: any) {
      // Check for 402 insufficient credits error
      if (err?.status === 402 || err?.message?.includes('402')) {
        try {
          const errorData = typeof err.body === 'string' ? JSON.parse(err.body) : err.body || {};
          setCreditsModalData({
            currentBalance: errorData.current_balance,
            requiredAmount: errorData.required,
          });
        } catch {
          setCreditsModalData({});
        }
        setCreditsModalOpen(true);
      } else {
        toast({
          title: 'Failed to start evaluation',
          description: err?.message || 'An error occurred',
          variant: 'destructive',
        });
      }
    } finally {
      setStartingEvalId(null);
    }
  };

  // Loading skeleton for evaluations
  const renderEvalsSkeleton = () => (
    <div className="border border-border rounded-lg bg-card">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead><Skeleton className="h-4 w-20" /></TableHead>
            <TableHead><Skeleton className="h-4 w-20" /></TableHead>
            <TableHead><Skeleton className="h-4 w-20" /></TableHead>
            <TableHead><Skeleton className="h-4 w-20" /></TableHead>
            <TableHead><Skeleton className="h-4 w-20" /></TableHead>
            <TableHead><Skeleton className="h-4 w-16" /></TableHead>
            <TableHead><Skeleton className="h-4 w-16" /></TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[1, 2, 3].map((i) => (
            <TableRow key={i} className="border-border">
              <TableCell><Skeleton className="h-4 w-40" /></TableCell>
              <TableCell><Skeleton className="h-6 w-28" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-5 w-32" /></TableCell>
              <TableCell><Skeleton className="h-5 w-20" /></TableCell>
              <TableCell><Skeleton className="h-4 w-12" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-8 w-24" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  // Loading skeleton for metrics
  const renderMetricsSkeleton = () => (
    <div className="grid gap-4 md:grid-cols-2">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="bg-card border-border">
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );

  // Error state
  const renderError = (error: Error | null, onRetry: () => void) => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
      <h3 className="text-lg font-semibold text-foreground mb-2">Failed to load data</h3>
      <p className="text-muted-foreground mb-4">{error?.message || "An unexpected error occurred"}</p>
      <Button onClick={onRetry} variant="outline">
        Try Again
      </Button>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Evaluations</h1>
              <p className="text-muted-foreground mt-1">
                Measure and compare model performance
              </p>
            </div>
            <Button
              onClick={() => setIsCreateEvalModalOpen(true)}
              className="bg-primary hover:bg-primary/90 gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Evaluation
            </Button>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="evaluations" className="animate-fade-in animate-delay-100">
            <TabsList className="bg-secondary border border-border">
              <TabsTrigger value="evaluations">Evaluations</TabsTrigger>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
            </TabsList>

            <TabsContent value="evaluations" className="mt-6">
              {evalsLoading ? (
                renderEvalsSkeleton()
              ) : evalsError ? (
                renderError(evalsError, refetchEvaluations)
              ) : !evaluations || evaluations.length === 0 ? (
                <EmptyState
                  icon={BarChart3}
                  title="No evaluations yet"
                  subtitle="Create your first evaluation to measure model performance"
                  actionLabel="Create Evaluation"
                  onAction={() => setIsCreateEvalModalOpen(true)}
                />
              ) : (
                <div className="border border-border rounded-lg bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-muted-foreground">Model</TableHead>
                        <TableHead className="text-muted-foreground">Snapshot</TableHead>
                        <TableHead className="text-muted-foreground">Metrics</TableHead>
                        <TableHead className="text-muted-foreground">Status</TableHead>
                        <TableHead className="text-muted-foreground text-right">Avg Score</TableHead>
                        <TableHead className="text-muted-foreground">Created</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {evaluations.map((evaluation) => {
                        const status = getStatusFromString(evaluation.status);
                        const avgScore = calculateAvgScore(evaluation.results as Record<string, unknown> | null);
                        const metricNames = getMetricNames(evaluation.metric_ids);
                        // Find model name from fine-tuned models or base models
                        const fineTunedModel = models?.find(m => m.id === evaluation.model_id);
                        const baseModel = BASE_EVALUATION_MODELS.find(m => m.id === evaluation.model_id);
                        const modelName = fineTunedModel?.name || baseModel?.name || evaluation.model_id;
                        const hasDetailedResults = evaluation.detailed_results && 
                          Array.isArray(evaluation.detailed_results) && 
                          evaluation.detailed_results.length > 0;

                        return (
                          <Collapsible key={evaluation.id} asChild>
                            <>
                              <TableRow className="border-border hover:bg-secondary/50">
                                <TableCell>
                                  <span className="text-xs px-2 py-1 rounded-full bg-secondary text-foreground">
                                    {modelName}
                                  </span>
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {evaluation.snapshot_id.slice(0, 8)}...
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1 flex-wrap">
                                    {metricNames.slice(0, 2).map((metric) => (
                                      <span
                                        key={metric}
                                        className="text-xs px-2 py-0.5 rounded-full bg-info/20 text-info"
                                      >
                                        {metric}
                                      </span>
                                    ))}
                                    {metricNames.length > 2 && (
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                        +{metricNames.length - 2}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <StatusBadge status={status} />
                                </TableCell>
                                <TableCell className="text-right">
                                  {avgScore !== null ? (
                                    <span className={cn("font-semibold", getScoreColor(avgScore))}>
                                      {avgScore}%
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {formatDate(evaluation.created_at)}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    {hasDetailedResults && (
                                      <CollapsibleTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => setExpandedEvaluation(
                                            expandedEvaluation === evaluation.id ? null : evaluation.id
                                          )}
                                        >
                                          <ChevronDown className={cn(
                                            "h-4 w-4 transition-transform",
                                            expandedEvaluation === evaluation.id && "rotate-180"
                                          )} />
                                        </Button>
                                      </CollapsibleTrigger>
                                    )}
                                    {status === 'pending' && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-success hover:text-success"
                                        onClick={() => handleStartEvaluation(evaluation.id)}
                                        disabled={startingEvalId === evaluation.id}
                                      >
                                        {startingEvalId === evaluation.id ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Play className="h-4 w-4" />
                                        )}
                                      </Button>
                                    )}
                                    {(status === 'completed' || status === 'failed') && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => handleStartEvaluation(evaluation.id)}
                                        disabled={startingEvalId === evaluation.id}
                                        title="Re-run evaluation"
                                      >
                                        {startingEvalId === evaluation.id ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <RotateCw className="h-4 w-4" />
                                        )}
                                      </Button>
                                    )}
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-8 w-8"
                                      onClick={() => navigate(`/dashboard/evaluations/${evaluation.id}`)}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive"
                                      onClick={() => setDeleteEvaluationId(evaluation.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              {hasDetailedResults && expandedEvaluation === evaluation.id && (
                                <TableRow>
                                  <TableCell colSpan={7} className="bg-secondary/30 p-4">
                                    <div className="space-y-2">
                                      <h4 className="text-sm font-medium text-foreground">Detailed Results</h4>
                                      <div className="grid gap-2 max-h-64 overflow-auto">
                                        {(evaluation.detailed_results as Array<{
                                          input: string;
                                          expected: string;
                                          actual: string;
                                          scores: Record<string, number>;
                                        }>).slice(0, 5).map((result, idx) => (
                                          <div key={idx} className="p-3 bg-card rounded-lg border border-border">
                                            <div className="text-xs text-muted-foreground mb-1">Input:</div>
                                            <div className="text-sm text-foreground mb-2 line-clamp-2">{result.input}</div>
                                            <div className="flex gap-2 flex-wrap">
                                              {Object.entries(result.scores || {}).map(([metric, score]) => (
                                                <span
                                                  key={metric}
                                                  className={cn(
                                                    "text-xs px-2 py-0.5 rounded-full",
                                                    score >= 0.8 ? "bg-success/20 text-success" :
                                                    score >= 0.5 ? "bg-warning/20 text-warning" :
                                                    "bg-destructive/20 text-destructive"
                                                  )}
                                                >
                                                  {metric}: {Math.round(score * 100)}%
                                                </span>
                                              ))}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </>
                          </Collapsible>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="metrics" className="mt-6 space-y-6">
              <div className="flex justify-end">
                <Button
                  onClick={() => setIsCreateMetricModalOpen(true)}
                  variant="outline"
                  className="gap-2 border-border"
                >
                  <Plus className="h-4 w-4" />
                  Create Metric
                </Button>
              </div>

              {metricsLoading ? (
                renderMetricsSkeleton()
              ) : metricsError ? (
                renderError(metricsError, refetchMetrics)
              ) : !metrics || metrics.length === 0 ? (
                <EmptyState
                  icon={BarChart3}
                  title="No metrics yet"
                  subtitle="Create custom metrics to evaluate your models"
                  actionLabel="Create Metric"
                  onAction={() => setIsCreateMetricModalOpen(true)}
                />
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {metrics.map((metric) => (
                    <Card key={metric.id} className="bg-card border-border">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-base text-foreground flex items-center gap-2">
                            {metric.name}
                            {metric.is_builtin && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground flex items-center gap-1">
                                <Lock className="h-3 w-3" />
                                Built-in
                              </span>
                            )}
                          </CardTitle>
                          {!metric.is_builtin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleteMetricId(metric.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          {metric.description || "No description"}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

      {/* Create Evaluation Modal */}
      <Dialog open={isCreateEvalModalOpen} onOpenChange={(open) => {
        setIsCreateEvalModalOpen(open);
        if (!open) {
          setEvalForm({ modelId: "", datasetId: "", snapshotId: "" });
          setSelectedMetrics([]);
        }
      }}>
        <DialogContent className="bg-card border-border sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-foreground">Create Evaluation</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Measure your model's performance against a test dataset
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-foreground">Model <span className="text-destructive">*</span></Label>
              <Select
                value={evalForm.modelId}
                onValueChange={(value) => setEvalForm(prev => ({ ...prev, modelId: value }))}
              >
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectGroup>
                    <SelectLabel className="text-muted-foreground text-xs font-semibold px-2 py-1.5">Base Models</SelectLabel>
                    {BASE_EVALUATION_MODELS.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                        <span className="text-muted-foreground ml-2 text-xs">({model.provider})</span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel className="text-muted-foreground text-xs font-semibold px-2 py-1.5">Your Models</SelectLabel>
                    {!models || models.length === 0 ? (
                      <SelectItem value="none" disabled className="text-muted-foreground italic">
                        No fine-tuned models yet
                      </SelectItem>
                    ) : (
                      models.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Dataset <span className="text-destructive">*</span></Label>
              <Select
                value={evalForm.datasetId}
                onValueChange={(value) => setEvalForm(prev => ({ ...prev, datasetId: value, snapshotId: "" }))}
              >
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Select a dataset" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {readyDatasets.length === 0 ? (
                    <SelectItem value="none" disabled>No ready datasets</SelectItem>
                  ) : (
                    readyDatasets.map((dataset) => (
                      <SelectItem key={dataset.id} value={dataset.id}>
                        {dataset.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Snapshot <span className="text-destructive">*</span></Label>
              <Select
                value={evalForm.snapshotId}
                onValueChange={(value) => setEvalForm(prev => ({ ...prev, snapshotId: value }))}
                disabled={!evalForm.datasetId}
              >
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder={evalForm.datasetId ? "Select a snapshot" : "Select dataset first"} />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {snapshots.length === 0 ? (
                    <SelectItem value="none" disabled>No snapshots available</SelectItem>
                  ) : (
                    snapshots.map((snapshot) => (
                      <SelectItem key={snapshot.id} value={snapshot.id}>
                        {snapshot.name} ({snapshot.row_count} rows)
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Metrics <span className="text-destructive">*</span></Label>
              <div className="space-y-2 max-h-48 overflow-auto">
                {metrics?.map((metric) => (
                  <label
                    key={metric.id}
                    className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-secondary cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedMetrics.includes(metric.id)}
                      onCheckedChange={(checked) => {
                        setSelectedMetrics(
                          checked
                            ? [...selectedMetrics, metric.id]
                            : selectedMetrics.filter((id) => id !== metric.id)
                        );
                      }}
                    />
                    <div>
                      <span className="text-sm font-medium text-foreground">{metric.name}</span>
                      {metric.is_builtin && (
                        <span className="ml-2 text-xs text-muted-foreground">(Built-in)</span>
                      )}
                      <p className="text-xs text-muted-foreground">{metric.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsCreateEvalModalOpen(false)}
              className="text-muted-foreground"
              disabled={isCreatingEval}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateEvaluation}
              disabled={!evalForm.modelId || !evalForm.snapshotId || selectedMetrics.length === 0 || isCreatingEval}
              className="bg-primary hover:bg-primary/90"
            >
              {isCreatingEval ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Start Evaluation"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Metric Modal */}
      <Dialog open={isCreateMetricModalOpen} onOpenChange={(open) => {
        setIsCreateMetricModalOpen(open);
        if (!open) {
          setMetricForm({ name: "", description: "", shouldRules: "", shouldNotRules: "" });
        }
      }}>
        <DialogContent className="bg-card border-border sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-foreground">Create Custom Metric</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Define rules for evaluating model responses
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-foreground">Metric Name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g., Tone Appropriateness"
                value={metricForm.name}
                onChange={(e) => setMetricForm(prev => ({ ...prev, name: e.target.value }))}
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Description</Label>
              <Textarea
                placeholder="What does this metric measure?"
                value={metricForm.description}
                onChange={(e) => setMetricForm(prev => ({ ...prev, description: e.target.value }))}
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Model SHOULD: (one per line)</Label>
              <Textarea
                placeholder="List behaviors the model should exhibit..."
                value={metricForm.shouldRules}
                onChange={(e) => setMetricForm(prev => ({ ...prev, shouldRules: e.target.value }))}
                className="bg-secondary border-border min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Model SHOULD NOT: (one per line)</Label>
              <Textarea
                placeholder="List behaviors the model should avoid..."
                value={metricForm.shouldNotRules}
                onChange={(e) => setMetricForm(prev => ({ ...prev, shouldNotRules: e.target.value }))}
                className="bg-secondary border-border min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsCreateMetricModalOpen(false)}
              className="text-muted-foreground"
              disabled={isCreatingMetric}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateMetric}
              disabled={!metricForm.name.trim() || isCreatingMetric}
              className="bg-primary hover:bg-primary/90"
            >
              {isCreatingMetric ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Metric"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Metric Confirmation */}
      <AlertDialog open={!!deleteMetricId} onOpenChange={(open) => !open && setDeleteMetricId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete Metric</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete this custom metric? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary border-border text-foreground">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMetric}
              disabled={isDeletingMetric}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingMetric ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Metric"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Evaluation Confirmation */}
      <AlertDialog open={!!deleteEvaluationId} onOpenChange={(open) => !open && setDeleteEvaluationId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete Evaluation</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete this evaluation? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary border-border text-foreground">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEvaluation}
              disabled={isDeletingEval}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingEval ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Evaluation"
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

export default Evaluations;
