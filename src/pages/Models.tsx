import { useState } from "react";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Model {
  id: string;
  name: string;
  modelId: string;
  baseModel: string;
  description?: string;
  parameterCount: string;
  contextLength: number;
  isDeployed: boolean;
  createdAt: string;
}

const mockModels: Model[] = [
  {
    id: "1",
    name: "Customer Support v2",
    modelId: "sv-llama3-customer-support-v2",
    baseModel: "Llama 3.2 3B",
    description: "Optimized for handling customer inquiries and support tickets",
    parameterCount: "3B",
    contextLength: 128000,
    isDeployed: true,
    createdAt: "2024-01-20",
  },
  {
    id: "2",
    name: "Sales Assistant v1",
    modelId: "sv-mistral-sales-assistant-v1",
    baseModel: "Mistral 7B",
    description: "Trained on sales conversations and product knowledge",
    parameterCount: "7B",
    contextLength: 32000,
    isDeployed: true,
    createdAt: "2024-01-18",
  },
  {
    id: "3",
    name: "Code Reviewer",
    modelId: "sv-qwen-code-reviewer",
    baseModel: "Qwen 2.5 7B",
    description: "Automated code review for Python and TypeScript",
    parameterCount: "7B",
    contextLength: 32000,
    isDeployed: false,
    createdAt: "2024-01-22",
  },
];

const Models = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const copyModelId = (modelId: string) => {
    navigator.clipboard.writeText(modelId);
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
              <h1 className="text-2xl font-semibold text-foreground">Models</h1>
              <p className="text-muted-foreground mt-1">
                Manage and deploy your fine-tuned models
              </p>
            </div>
          </div>

          {/* Models Grid */}
          {mockModels.length === 0 ? (
            <EmptyState
              icon={Cpu}
              title="No models yet"
              subtitle="Complete a fine-tuning job to create your first model"
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {mockModels.map((model, index) => (
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
                          <p className="text-xs text-muted-foreground">{model.baseModel}</p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          <DropdownMenuItem onClick={() => copyModelId(model.modelId)} className="cursor-pointer">
                            <Copy className="mr-2 h-4 w-4" />
                            Copy Model ID
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer">
                            <Download className="mr-2 h-4 w-4" />
                            Download Checkpoint
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer text-destructive">
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
                        {model.modelId}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyModelId(model.modelId)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground">
                        {model.parameterCount} params
                      </span>
                      <span className="text-muted-foreground">
                        {(model.contextLength / 1000).toFixed(0)}K context
                      </span>
                    </div>

                    {/* Deployment Status */}
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <div className="flex items-center gap-2">
                        {model.isDeployed ? (
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
                      </div>
                      <Button variant="outline" size="sm" className="gap-1 border-border">
                        <Play className="h-3 w-3" />
                        Test
                      </Button>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Created {formatDate(model.createdAt)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Models;
