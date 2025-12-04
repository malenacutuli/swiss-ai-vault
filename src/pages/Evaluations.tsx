import { useState } from "react";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Select,
  SelectContent,
  SelectItem,
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
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import {
  Plus,
  BarChart3,
  Eye,
  RotateCw,
  Trash2,
  CheckCircle,
  AlertCircle,
  Lock,
} from "lucide-react";

type EvaluationStatus = "pending" | "running" | "completed" | "failed";

interface Evaluation {
  id: string;
  name: string;
  modelName: string;
  datasetName: string;
  metrics: string[];
  status: EvaluationStatus;
  avgScore?: number;
  createdAt: string;
}

interface Metric {
  id: string;
  name: string;
  description: string;
  isBuiltin: boolean;
}

const mockEvaluations: Evaluation[] = [
  {
    id: "1",
    name: "Customer Support Quality Check",
    modelName: "customer-support-v2",
    datasetName: "test-set-v1",
    metrics: ["Correctness", "Conciseness"],
    status: "completed",
    avgScore: 87,
    createdAt: "2024-01-22",
  },
  {
    id: "2",
    name: "Sales Bot Accuracy",
    modelName: "sales-assistant-v1",
    datasetName: "sales-qa-test",
    metrics: ["Correctness", "Hallucination"],
    status: "running",
    createdAt: "2024-01-23",
  },
  {
    id: "3",
    name: "Code Review Evaluation",
    modelName: "code-reviewer",
    datasetName: "code-review-test",
    metrics: ["Correctness"],
    status: "pending",
    createdAt: "2024-01-23",
  },
];

const mockMetrics: Metric[] = [
  { id: "1", name: "Correctness", description: "Measures factual accuracy of responses", isBuiltin: true },
  { id: "2", name: "Conciseness", description: "Measures brevity without losing meaning", isBuiltin: true },
  { id: "3", name: "Hallucination", description: "Detects fabricated or made-up information", isBuiltin: true },
  { id: "4", name: "Tone Appropriateness", description: "Custom metric for professional tone", isBuiltin: false },
];

const getScoreColor = (score: number) => {
  if (score >= 80) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-destructive";
};

const Evaluations = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isCreateEvalModalOpen, setIsCreateEvalModalOpen] = useState(false);
  const [isCreateMetricModalOpen, setIsCreateMetricModalOpen] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
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
              {mockEvaluations.length === 0 ? (
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
                        <TableHead className="text-muted-foreground">Name</TableHead>
                        <TableHead className="text-muted-foreground">Model</TableHead>
                        <TableHead className="text-muted-foreground">Dataset</TableHead>
                        <TableHead className="text-muted-foreground">Metrics</TableHead>
                        <TableHead className="text-muted-foreground">Status</TableHead>
                        <TableHead className="text-muted-foreground text-right">Avg Score</TableHead>
                        <TableHead className="text-muted-foreground">Created</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockEvaluations.map((evaluation) => (
                        <TableRow key={evaluation.id} className="border-border hover:bg-secondary/50">
                          <TableCell className="font-medium text-foreground">
                            {evaluation.name}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs px-2 py-1 rounded-full bg-secondary text-foreground">
                              {evaluation.modelName}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {evaluation.datasetName}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {evaluation.metrics.map((metric) => (
                                <span
                                  key={metric}
                                  className="text-xs px-2 py-0.5 rounded-full bg-info/20 text-info"
                                >
                                  {metric}
                                </span>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={evaluation.status} />
                          </TableCell>
                          <TableCell className="text-right">
                            {evaluation.avgScore !== undefined ? (
                              <span className={cn("font-semibold", getScoreColor(evaluation.avgScore))}>
                                {evaluation.avgScore}%
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(evaluation.createdAt)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <RotateCw className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
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

              <div className="grid gap-4 md:grid-cols-2">
                {mockMetrics.map((metric) => (
                  <Card key={metric.id} className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base text-foreground flex items-center gap-2">
                          {metric.name}
                          {metric.isBuiltin && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground flex items-center gap-1">
                              <Lock className="h-3 w-3" />
                              Built-in
                            </span>
                          )}
                        </CardTitle>
                        {!metric.isBuiltin && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{metric.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* Create Evaluation Modal */}
      <Dialog open={isCreateEvalModalOpen} onOpenChange={setIsCreateEvalModalOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-foreground">Create Evaluation</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Measure your model's performance against a test dataset
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-foreground">Model</Label>
              <Select>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="1">customer-support-v2</SelectItem>
                  <SelectItem value="2">sales-assistant-v1</SelectItem>
                  <SelectItem value="3">code-reviewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Dataset Snapshot</Label>
              <Select>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Select a snapshot" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="1">test-set-v1 (500 rows)</SelectItem>
                  <SelectItem value="2">test-set-v2 (750 rows)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Metrics</Label>
              <div className="space-y-2">
                {mockMetrics.map((metric) => (
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
                      <p className="text-xs text-muted-foreground">{metric.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCreateEvalModalOpen(false)} className="text-muted-foreground">
              Cancel
            </Button>
            <Button className="bg-primary hover:bg-primary/90">
              Start Evaluation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Metric Modal */}
      <Dialog open={isCreateMetricModalOpen} onOpenChange={setIsCreateMetricModalOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-foreground">Create Custom Metric</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Define rules for evaluating model responses
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-foreground">Metric Name</Label>
              <Input placeholder="e.g., Tone Appropriateness" className="bg-secondary border-border" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Description</Label>
              <Textarea placeholder="What does this metric measure?" className="bg-secondary border-border" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Model SHOULD:</Label>
              <Textarea placeholder="List behaviors the model should exhibit..." className="bg-secondary border-border min-h-[80px]" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Model SHOULD NOT:</Label>
              <Textarea placeholder="List behaviors the model should avoid..." className="bg-secondary border-border min-h-[80px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCreateMetricModalOpen(false)} className="text-muted-foreground">
              Cancel
            </Button>
            <Button className="bg-primary hover:bg-primary/90">
              Create Metric
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Evaluations;
