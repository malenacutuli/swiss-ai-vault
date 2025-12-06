import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { InsufficientCreditsModal } from "@/components/InsufficientCreditsModal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Play,
  RotateCw,
  Download,
  Copy,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  BarChart3,
  FileJson,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { useEvaluations, useMetrics, useModels, useStartEvaluation } from "@/hooks/useSupabase";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { EvaluationStatus } from "@/types/database";

// Base models available for evaluation
const BASE_EVALUATION_MODELS = [
  { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI" },
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI" },
  { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", provider: "Anthropic" },
  { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", provider: "Anthropic" },
];

interface DetailedResult {
  input: string;
  expected: string;
  actual: string;
  scores: Record<string, number>;
  reasoning?: Record<string, string>;
}

interface MetricResults {
  average: number;
  min: number;
  max: number;
  count: number;
}

const EvaluationDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [scoreFilter, setScoreFilter] = useState<string>("all");
  const [creditsModalOpen, setCreditsModalOpen] = useState(false);
  const [creditsModalData, setCreditsModalData] = useState<{ currentBalance?: number; requiredAmount?: number }>({});
  const [isStarting, setIsStarting] = useState(false);

  const ITEMS_PER_PAGE = 20;

  // Fetch evaluation
  const { evaluations, loading: evalsLoading, refetch: refetchEvaluations } = useEvaluations();
  const { metrics } = useMetrics();
  const { models } = useModels();
  const { startEvaluation } = useStartEvaluation();

  const evaluation = useMemo(() => 
    evaluations?.find(e => e.id === id), 
    [evaluations, id]
  );

  // Fetch snapshot info
  const { data: snapshotData } = useQuery({
    queryKey: ["snapshot", evaluation?.snapshot_id],
    queryFn: async () => {
      if (!evaluation?.snapshot_id) return null;
      const { data } = await supabase
        .from("dataset_snapshots")
        .select("*, datasets(name)")
        .eq("id", evaluation.snapshot_id)
        .maybeSingle();
      return data;
    },
    enabled: !!evaluation?.snapshot_id,
  });

  const status = (evaluation?.status || "pending") as EvaluationStatus;
  const results = evaluation?.results as unknown as Record<string, MetricResults> | null;
  const detailedResults = evaluation?.detailed_results as unknown as DetailedResult[] | null;

  // Get model info
  const fineTunedModel = models?.find(m => m.id === evaluation?.model_id);
  const baseModel = BASE_EVALUATION_MODELS.find(m => m.id === evaluation?.model_id);
  const modelName = fineTunedModel?.name || baseModel?.name || evaluation?.model_id || "Unknown";
  const isFineTunedModel = !!fineTunedModel;

  // Get metric info
  const evaluationMetrics = useMemo(() => {
    if (!evaluation?.metric_ids || !metrics) return [];
    return evaluation.metric_ids
      .map(mId => metrics.find(m => m.id === mId))
      .filter((m): m is NonNullable<typeof m> => !!m);
  }, [evaluation?.metric_ids, metrics]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!results) return [];
    return Object.entries(results).map(([metricId, data]) => {
      const metric = metrics?.find(m => m.id === metricId);
      return {
        name: metric?.name || metricId.slice(0, 8),
        score: Math.round(data.average * 100),
        fill: data.average >= 0.7 ? "hsl(var(--success))" :
              data.average >= 0.4 ? "hsl(var(--warning))" :
              "hsl(var(--destructive))",
      };
    });
  }, [results, metrics]);

  // Filter and sort detailed results
  const processedResults = useMemo(() => {
    if (!detailedResults) return [];
    
    let filtered = [...detailedResults];
    
    // Apply score filter
    if (scoreFilter !== "all") {
      filtered = filtered.filter(result => {
        const avgScore = Object.values(result.scores).reduce((a, b) => a + b, 0) / 
                        Object.values(result.scores).length;
        if (scoreFilter === "high") return avgScore >= 0.7;
        if (scoreFilter === "medium") return avgScore >= 0.4 && avgScore < 0.7;
        if (scoreFilter === "low") return avgScore < 0.4;
        return true;
      });
    }
    
    // Apply sorting
    if (sortColumn) {
      filtered.sort((a, b) => {
        const aVal = a.scores[sortColumn] || 0;
        const bVal = b.scores[sortColumn] || 0;
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      });
    }
    
    return filtered;
  }, [detailedResults, scoreFilter, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(processedResults.length / ITEMS_PER_PAGE);
  const paginatedResults = processedResults.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.7) return "text-success";
    if (score >= 0.4) return "text-warning";
    return "text-destructive";
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 0.7) return "bg-success/20 text-success";
    if (score >= 0.4) return "bg-warning/20 text-warning";
    return "bg-destructive/20 text-destructive";
  };

  const toggleRow = (index: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  const handleSort = (metricId: string) => {
    if (sortColumn === metricId) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(metricId);
      setSortDirection("desc");
    }
  };

  const handleStartEvaluation = async () => {
    if (!evaluation) return;
    setIsStarting(true);
    try {
      const success = await startEvaluation(evaluation.id);
      if (success) {
        toast({
          title: "Evaluation started",
          description: "Your evaluation is now running.",
        });
        refetchEvaluations();
      }
    } catch (err: any) {
      if (err?.status === 402 || err?.message?.includes("402")) {
        try {
          const errorData = typeof err.body === "string" ? JSON.parse(err.body) : err.body || {};
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
          title: "Failed to start evaluation",
          description: err?.message || "An error occurred",
          variant: "destructive",
        });
      }
    } finally {
      setIsStarting(false);
    }
  };

  const exportAsJSON = () => {
    if (!evaluation) return;
    const exportData = {
      id: evaluation.id,
      model_id: evaluation.model_id,
      snapshot_id: evaluation.snapshot_id,
      metrics: evaluationMetrics.map(m => ({ id: m.id, name: m.name })),
      results,
      detailed_results: detailedResults,
      created_at: evaluation.created_at,
      completed_at: evaluation.completed_at,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `evaluation-${evaluation.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAsCSV = () => {
    if (!evaluation || !detailedResults) return;
    const metricIds = Object.keys(detailedResults[0]?.scores || {});
    const headers = ["#", "Input", "Expected", "Actual", ...metricIds.map(id => {
      const metric = metrics?.find(m => m.id === id);
      return metric?.name || id;
    })];
    
    const rows = detailedResults.map((result, idx) => [
      idx + 1,
      `"${result.input.replace(/"/g, '""')}"`,
      `"${result.expected.replace(/"/g, '""')}"`,
      `"${result.actual.replace(/"/g, '""')}"`,
      ...metricIds.map(id => Math.round((result.scores[id] || 0) * 100) + "%"),
    ]);
    
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `evaluation-${evaluation.id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = () => {
    if (!evaluation) return;
    const exportData = {
      id: evaluation.id,
      model_id: evaluation.model_id,
      results,
    };
    navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
    toast({
      title: "Copied to clipboard",
      description: "Evaluation results copied successfully.",
    });
  };

  if (evalsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <div className={cn("transition-all duration-300", sidebarCollapsed ? "ml-16" : "ml-[280px]")}>
          <DashboardHeader sidebarCollapsed={sidebarCollapsed} />
          <main className="p-6 space-y-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-96 w-full" />
          </main>
        </div>
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <div className={cn("transition-all duration-300", sidebarCollapsed ? "ml-16" : "ml-[280px]")}>
          <DashboardHeader sidebarCollapsed={sidebarCollapsed} />
          <main className="p-6">
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">Evaluation not found</h2>
              <p className="text-muted-foreground mb-4">The evaluation you're looking for doesn't exist.</p>
              <Button onClick={() => navigate("/dashboard/evaluations")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Evaluations
              </Button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <div className={cn("transition-all duration-300", sidebarCollapsed ? "ml-16" : "ml-[280px]")}>
        <DashboardHeader sidebarCollapsed={sidebarCollapsed} />
        
        <main className="p-6 space-y-6">
          {/* Breadcrumb */}
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/dashboard">Dashboard</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/dashboard/evaluations">Evaluations</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{evaluation.id.slice(0, 8)}...</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <Button variant="outline" size="icon" onClick={() => navigate("/dashboard/evaluations")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-semibold text-foreground">
                    Evaluation {evaluation.id.slice(0, 8)}
                  </h1>
                  <StatusBadge status={status} />
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Model:</span>
                  {isFineTunedModel ? (
                    <Link 
                      to={`/dashboard/models/${evaluation.model_id}`}
                      className="text-primary hover:underline"
                    >
                      {modelName}
                    </Link>
                  ) : (
                    <span className="text-foreground">{modelName}</span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-2">
              {status === "pending" && (
                <Button onClick={handleStartEvaluation} disabled={isStarting} className="gap-2">
                  {isStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Run Evaluation
                </Button>
              )}
              {status === "running" && (
                <Button disabled variant="outline" className="gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running...
                </Button>
              )}
              {(status === "completed" || status === "failed") && (
                <Button onClick={handleStartEvaluation} disabled={isStarting} variant="outline" className="gap-2">
                  {isStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                  Re-run
                </Button>
              )}
              {status === "completed" && (
                <>
                  <Button onClick={exportAsJSON} variant="outline" className="gap-2">
                    <FileJson className="h-4 w-4" />
                    JSON
                  </Button>
                  <Button onClick={exportAsCSV} variant="outline" className="gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    CSV
                  </Button>
                  <Button onClick={copyToClipboard} variant="outline" size="icon">
                    <Copy className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Error State */}
          {status === "failed" && evaluation.error_message && (
            <Card className="border-destructive bg-destructive/10">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-destructive mb-1">Evaluation Failed</h3>
                    <p className="text-sm text-muted-foreground">{evaluation.error_message}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Configuration Card */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Configuration</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Model</p>
                <p className="font-medium text-foreground">{modelName}</p>
                <p className="text-xs text-muted-foreground">
                  {isFineTunedModel ? "Fine-tuned" : baseModel?.provider || "Base Model"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Dataset/Snapshot</p>
                <p className="font-medium text-foreground">
                  {snapshotData?.datasets?.name || "Unknown Dataset"}
                </p>
                <p className="text-xs text-muted-foreground">
                  v{snapshotData?.version || 1} • {snapshotData?.row_count || 0} rows
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Metrics</p>
                <div className="flex flex-wrap gap-1">
                  {evaluationMetrics.map(metric => (
                    <span 
                      key={metric.id} 
                      className="text-xs px-2 py-0.5 rounded-full bg-info/20 text-info"
                    >
                      {metric.name}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Samples Evaluated</p>
                <p className="font-medium text-foreground">
                  {detailedResults?.length || 0}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Aggregate Results */}
          {status === "completed" && results && (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {Object.entries(results).map(([metricId, data]) => {
                  const metric = metrics?.find(m => m.id === metricId);
                  return (
                    <Card key={metricId} className="bg-card border-border">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">{metric?.name || metricId}</CardTitle>
                        {metric?.description && (
                          <CardDescription className="text-xs">
                            {metric.description}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-baseline gap-2">
                          <span className={cn("text-3xl font-bold", getScoreColor(data.average))}>
                            {Math.round(data.average * 100)}%
                          </span>
                          <span className="text-sm text-muted-foreground">avg</span>
                        </div>
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                          <span>Min: {Math.round(data.min * 100)}%</span>
                          <span>Max: {Math.round(data.max * 100)}%</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Chart */}
              {chartData.length > 0 && (
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-lg">Results Comparison</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis 
                            type="number" 
                            domain={[0, 100]} 
                            tickFormatter={(v) => `${v}%`}
                            stroke="hsl(var(--muted-foreground))"
                          />
                          <YAxis 
                            dataKey="name" 
                            type="category" 
                            width={120}
                            stroke="hsl(var(--muted-foreground))"
                          />
                          <Tooltip 
                            formatter={(value: number) => [`${value}%`, "Score"]}
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                          />
                          <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Detailed Results Table */}
          {status === "completed" && detailedResults && detailedResults.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Detailed Results</CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={scoreFilter} onValueChange={setScoreFilter}>
                    <SelectTrigger className="w-32 h-8 text-sm">
                      <SelectValue placeholder="Filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Scores</SelectItem>
                      <SelectItem value="high">High (≥70%)</SelectItem>
                      <SelectItem value="medium">Medium (40-70%)</SelectItem>
                      <SelectItem value="low">Low (&lt;40%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="w-12">#</TableHead>
                        <TableHead className="min-w-[200px]">Input</TableHead>
                        <TableHead className="min-w-[150px]">Expected</TableHead>
                        <TableHead className="min-w-[150px]">Actual</TableHead>
                        {evaluationMetrics.map(metric => (
                          <TableHead 
                            key={metric.id} 
                            className="cursor-pointer hover:bg-secondary/50 min-w-[100px]"
                            onClick={() => handleSort(metric.id)}
                          >
                            <div className="flex items-center gap-1">
                              {metric.name}
                              {sortColumn === metric.id && (
                                sortDirection === "asc" ? 
                                  <ChevronUp className="h-3 w-3" /> : 
                                  <ChevronDown className="h-3 w-3" />
                              )}
                            </div>
                          </TableHead>
                        ))}
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedResults.map((result, idx) => {
                        const globalIdx = (currentPage - 1) * ITEMS_PER_PAGE + idx;
                        const isExpanded = expandedRows.has(globalIdx);
                        
                        return (
                          <Collapsible key={globalIdx} asChild open={isExpanded}>
                            <>
                              <TableRow className="border-border hover:bg-secondary/50">
                                <TableCell className="text-muted-foreground">
                                  {globalIdx + 1}
                                </TableCell>
                                <TableCell>
                                  <p className="line-clamp-2 text-sm">{result.input}</p>
                                </TableCell>
                                <TableCell>
                                  <p className="line-clamp-2 text-sm text-muted-foreground">
                                    {result.expected}
                                  </p>
                                </TableCell>
                                <TableCell>
                                  <p className="line-clamp-2 text-sm text-muted-foreground">
                                    {result.actual}
                                  </p>
                                </TableCell>
                                {evaluationMetrics.map(metric => {
                                  const score = result.scores[metric.id] || 0;
                                  return (
                                    <TableCell key={metric.id}>
                                      <span className={cn(
                                        "text-xs px-2 py-1 rounded-full font-medium",
                                        getScoreBgColor(score)
                                      )}>
                                        {Math.round(score * 100)}%
                                      </span>
                                    </TableCell>
                                  );
                                })}
                                <TableCell>
                                  <CollapsibleTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-8 w-8"
                                      onClick={() => toggleRow(globalIdx)}
                                    >
                                      <ChevronDown className={cn(
                                        "h-4 w-4 transition-transform",
                                        isExpanded && "rotate-180"
                                      )} />
                                    </Button>
                                  </CollapsibleTrigger>
                                </TableCell>
                              </TableRow>
                              {isExpanded && (
                                <TableRow className="border-border bg-secondary/30">
                                  <TableCell colSpan={5 + evaluationMetrics.length} className="p-4">
                                    <div className="space-y-4">
                                      <div className="grid gap-4 md:grid-cols-3">
                                        <div>
                                          <p className="text-xs font-medium text-muted-foreground mb-1">
                                            Full Input
                                          </p>
                                          <p className="text-sm bg-card p-2 rounded border border-border whitespace-pre-wrap">
                                            {result.input}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-xs font-medium text-muted-foreground mb-1">
                                            Expected Output
                                          </p>
                                          <p className="text-sm bg-card p-2 rounded border border-border whitespace-pre-wrap">
                                            {result.expected}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-xs font-medium text-muted-foreground mb-1">
                                            Actual Output
                                          </p>
                                          <p className="text-sm bg-card p-2 rounded border border-border whitespace-pre-wrap">
                                            {result.actual}
                                          </p>
                                        </div>
                                      </div>
                                      {result.reasoning && Object.keys(result.reasoning).length > 0 && (
                                        <div>
                                          <p className="text-xs font-medium text-muted-foreground mb-2">
                                            Reasoning
                                          </p>
                                          <div className="space-y-2">
                                            {Object.entries(result.reasoning).map(([metricId, reason]) => {
                                              const metric = metrics?.find(m => m.id === metricId);
                                              return (
                                                <div 
                                                  key={metricId} 
                                                  className="bg-card p-2 rounded border border-border"
                                                >
                                                  <p className="text-xs font-medium text-foreground mb-1">
                                                    {metric?.name || metricId}
                                                  </p>
                                                  <p className="text-sm text-muted-foreground">
                                                    {reason}
                                                  </p>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
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
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                      {Math.min(currentPage * ITEMS_PER_PAGE, processedResults.length)} of{" "}
                      {processedResults.length} results
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => p - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(p => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Pending/Running State */}
          {(status === "pending" || status === "running") && (
            <Card className="bg-card border-border">
              <CardContent className="py-12 text-center">
                <div className="flex flex-col items-center">
                  {status === "pending" ? (
                    <>
                      <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        Evaluation Pending
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        Click "Run Evaluation" to start measuring model performance.
                      </p>
                    </>
                  ) : (
                    <>
                      <Loader2 className="h-12 w-12 text-primary mb-4 animate-spin" />
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        Evaluation Running
                      </h3>
                      <p className="text-muted-foreground">
                        Processing samples and calculating metrics...
                      </p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>

      <InsufficientCreditsModal
        open={creditsModalOpen}
        onClose={() => setCreditsModalOpen(false)}
        currentBalance={creditsModalData.currentBalance}
        requiredAmount={creditsModalData.requiredAmount}
      />
    </div>
  );
};

export default EvaluationDetail;
