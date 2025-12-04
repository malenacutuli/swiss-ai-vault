import { useState } from "react";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
  SlidersHorizontal,
  Clock,
  Eye,
  Download,
  Trash2,
  Check,
  Sparkles,
} from "lucide-react";

type JobStatus = "pending" | "queued" | "training" | "completed" | "failed" | "cancelled";
type Method = "lora" | "qlora" | "full";

interface FinetuningJob {
  id: string;
  name: string;
  baseModel: string;
  datasetName: string;
  method: Method;
  status: JobStatus;
  progress?: number;
  trainingTime?: string;
  finalLoss?: number;
  createdAt: string;
}

const mockJobs: FinetuningJob[] = [
  {
    id: "1",
    name: "customer-support-v2",
    baseModel: "Llama 3.2 3B",
    datasetName: "customer-support-v1.jsonl",
    method: "lora",
    status: "completed",
    trainingTime: "2h 34m",
    finalLoss: 0.42,
    createdAt: "2024-01-20",
  },
  {
    id: "2",
    name: "sales-assistant-v1",
    baseModel: "Mistral 7B",
    datasetName: "sales-faq-synthetic",
    method: "qlora",
    status: "training",
    progress: 67,
    trainingTime: "1h 12m",
    createdAt: "2024-01-22",
  },
  {
    id: "3",
    name: "code-reviewer",
    baseModel: "Qwen 2.5 7B",
    datasetName: "code-reviews.jsonl",
    method: "lora",
    status: "queued",
    createdAt: "2024-01-23",
  },
  {
    id: "4",
    name: "legal-analyzer-v1",
    baseModel: "Llama 3.2 1B",
    datasetName: "legal-docs-enriched",
    method: "full",
    status: "failed",
    createdAt: "2024-01-21",
  },
];

const baseModels = [
  { id: "llama3.2-1b", name: "Llama 3.2 1B", params: "1B", context: "128K", recommended: false },
  { id: "llama3.2-3b", name: "Llama 3.2 3B", params: "3B", context: "128K", recommended: true },
  { id: "mistral-7b", name: "Mistral 7B", params: "7B", context: "32K", recommended: false },
  { id: "qwen2.5-0.5b", name: "Qwen 2.5 0.5B", params: "0.5B", context: "32K", recommended: false },
  { id: "qwen2.5-1.5b", name: "Qwen 2.5 1.5B", params: "1.5B", context: "32K", recommended: false },
  { id: "qwen2.5-3b", name: "Qwen 2.5 3B", params: "3B", context: "32K", recommended: false },
  { id: "qwen2.5-7b", name: "Qwen 2.5 7B", params: "7B", context: "32K", recommended: false },
  { id: "gemma2-2b", name: "Gemma 2 2B", params: "2B", context: "8K", recommended: false },
  { id: "gemma2-9b", name: "Gemma 2 9B", params: "9B", context: "8K", recommended: false },
];

const methodBadges: Record<Method, string> = {
  lora: "bg-info/20 text-info",
  qlora: "bg-purple-500/20 text-purple-400",
  full: "bg-warning/20 text-warning",
};

const Finetuning = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [selectedModel, setSelectedModel] = useState("");

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

          {/* Jobs Grid */}
          {mockJobs.length === 0 ? (
            <EmptyState
              icon={SlidersHorizontal}
              title="No fine-tuning jobs yet"
              subtitle="Create your first job to start training custom models"
              actionLabel="Create Job"
              onAction={() => setIsCreateModalOpen(true)}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {mockJobs.map((job, index) => (
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
                          {job.datasetName}
                        </p>
                      </div>
                      <StatusBadge status={job.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Model & Method */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 rounded-full bg-secondary text-foreground">
                        {job.baseModel}
                      </span>
                      <span className={cn("text-xs px-2 py-1 rounded-full uppercase", methodBadges[job.method])}>
                        {job.method}
                      </span>
                    </div>

                    {/* Progress (for training jobs) */}
                    {job.status === "training" && job.progress !== undefined && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="text-foreground font-medium">{job.progress}%</span>
                        </div>
                        <Progress value={job.progress} className="h-2" />
                      </div>
                    )}

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-sm">
                      {job.trainingTime && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>{job.trainingTime}</span>
                        </div>
                      )}
                      {job.finalLoss !== undefined && (
                        <div className="text-muted-foreground">
                          Loss: <span className="text-foreground">{job.finalLoss}</span>
                        </div>
                      )}
                      <div className="text-muted-foreground ml-auto">
                        {formatDate(job.createdAt)}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-border">
                      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                        <Eye className="h-4 w-4 mr-1" />
                        Details
                      </Button>
                      {job.status === "completed" && (
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive ml-auto">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Create Job Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={(open) => {
        setIsCreateModalOpen(open);
        if (!open) {
          setCreateStep(1);
          setSelectedModel("");
        }
      }}>
        <DialogContent className="bg-card border-border sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Create Fine-tuning Job
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Step {createStep} of 4 -{" "}
              {createStep === 1
                ? "Basics"
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
                  <Label className="text-foreground">Job Name</Label>
                  <Input placeholder="e.g., customer-support-v3" className="bg-secondary border-border" />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Dataset</Label>
                  <Select>
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue placeholder="Select a dataset" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="1">customer-support-v1.jsonl (Ready)</SelectItem>
                      <SelectItem value="2">sales-faq-synthetic (Ready)</SelectItem>
                      <SelectItem value="3">code-reviews.jsonl (Ready)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Snapshot</Label>
                  <Select>
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue placeholder="Select a snapshot" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="v1">v1.0 - 15,420 rows</SelectItem>
                      <SelectItem value="v2">v2.0 - 18,200 rows</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {createStep === 2 && (
              <div className="grid grid-cols-3 gap-3">
                {baseModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => setSelectedModel(model.id)}
                    className={cn(
                      "flex flex-col items-start p-4 rounded-lg border transition-colors text-left",
                      selectedModel === model.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-muted-foreground"
                    )}
                  >
                    {model.recommended && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-success/20 text-success mb-2">
                        <Sparkles className="h-3 w-3 inline mr-1" />
                        Recommended
                      </span>
                    )}
                    <span className="font-medium text-foreground">{model.name}</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      {model.params} params • {model.context} context
                    </span>
                    {selectedModel === model.id && (
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
                    {["LoRA", "QLoRA", "Full"].map((method) => (
                      <Button
                        key={method}
                        variant="outline"
                        className={cn(
                          "flex-1 border-border",
                          method === "LoRA" && "border-primary bg-primary/10"
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
                    <Input type="number" defaultValue={4} className="bg-secondary border-border" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">Learning Rate</Label>
                    <Input type="text" defaultValue="0.0002" className="bg-secondary border-border" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">Epochs</Label>
                    <Input type="number" defaultValue={3} className="bg-secondary border-border" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">LoRA Rank</Label>
                    <Select defaultValue="16">
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
                </div>
              </div>
            )}

            {createStep === 4 && (
              <div className="space-y-4">
                <div className="p-4 bg-secondary rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Job Name</span>
                    <span className="text-foreground">customer-support-v3</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Model</span>
                    <span className="text-foreground">Llama 3.2 3B</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Method</span>
                    <span className="text-foreground">LoRA</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dataset</span>
                    <span className="text-foreground">customer-support-v1.jsonl</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Estimated Time</span>
                    <span className="text-foreground">~2-3 hours</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Estimated Cost</span>
                    <span className="text-foreground">$6.25</span>
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
                  setIsCreateModalOpen(false);
                } else {
                  setCreateStep(createStep - 1);
                }
              }}
              className="text-muted-foreground"
            >
              {createStep === 1 ? "Cancel" : "Back"}
            </Button>
            <Button
              onClick={() => {
                if (createStep < 4) {
                  setCreateStep(createStep + 1);
                } else {
                  setIsCreateModalOpen(false);
                  setCreateStep(1);
                }
              }}
              className="bg-primary hover:bg-primary/90"
            >
              {createStep === 4 ? "Start Training" : "Next"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Finetuning;
