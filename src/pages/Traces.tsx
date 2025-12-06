import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useState } from "react";
import { useTraces, useTraceModels, Trace } from "@/hooks/useTraces";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  BookOpen,
  Key,
  Cpu,
  Copy,
  Check,
  Info,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

const Traces = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [modelFilter, setModelFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: tracesData, isLoading } = useTraces(modelFilter, page, pageSize);
  const { data: models } = useTraceModels();

  const traces = tracesData?.data || [];
  const totalCount = tracesData?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const getInputFromRequest = (request: Record<string, unknown>) => {
    const messages = request.messages as Array<{ role: string; content: string }> | undefined;
    if (messages && messages.length > 0) {
      const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
      return lastUserMessage?.content || "-";
    }
    return "-";
  };

  const getOutputFromResponse = (response: Record<string, unknown> | null) => {
    if (!response) return "-";
    const choices = response.choices as Array<{ message?: { content?: string } }> | undefined;
    if (choices && choices[0]?.message?.content) {
      return choices[0].message.content;
    }
    return "-";
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
        <main className="flex-1 p-6">
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Header */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Activity className="h-7 w-7 text-primary" />
                  <h1 className="text-2xl font-semibold text-foreground">
                    Traces & Feedback
                  </h1>
                </div>
                <p className="text-muted-foreground">
                  Track your model interactions and collect feedback to improve performance.
                </p>
              </div>

              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-48 w-full" />
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : traces.length === 0 ? (
                <EmptyState />
              ) : (
                <TracesTable
                  traces={traces}
                  models={models || []}
                  modelFilter={modelFilter}
                  setModelFilter={setModelFilter}
                  page={page}
                  setPage={setPage}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  getInputFromRequest={getInputFromRequest}
                  getOutputFromResponse={getOutputFromResponse}
                />
              )}
            </div>
          </main>
        </div>
      </div>
    );
};

function EmptyState() {
  return (
    <div className="space-y-6">
      {/* Get Started Box */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h3 className="font-semibold text-foreground mb-1">
                Get Started with Traces
              </h3>
              <p className="text-sm text-muted-foreground">
                No traces found yet. Use the API examples below to start sending traces.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Usage Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">API Usage</h2>

        <CodeBlock
          title="Add a Trace with Feedback"
          code={`curl -X POST https://your-api-url/api/v1/traces \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '[{
    "modelId": "your-model-id",
    "projectId": "your-project-id",
    "input": "What is the capital of France?",
    "output": "The capital of France is Paris.",
    "score": 0.95,
    "feedback": "Accurate and helpful response"
  }]'`}
        />

        <CodeBlock
          title="List Traces"
          code={`curl -X GET https://your-api-url/api/v1/traces \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`}
        />
      </div>

      {/* Resources Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Resources</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ResourceCard
            icon={BookOpen}
            title="API Documentation"
            description="Learn how to use the Traces API"
            href="#"
          />
          <ResourceCard
            icon={Key}
            title="API Keys"
            description="Manage your API keys"
            href="/dashboard/settings"
          />
          <ResourceCard
            icon={Cpu}
            title="Models"
            description="View your models"
            href="/dashboard/models"
          />
        </div>
      </div>
    </div>
  );
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="h-8 w-8"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <pre className="bg-secondary/50 rounded-lg p-4 overflow-x-auto text-sm font-mono text-foreground">
          <code>{code}</code>
        </pre>
      </CardContent>
    </Card>
  );
}

function ResourceCard({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link to={href}>
      <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">{title}</h3>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function TracesTable({
  traces,
  models,
  modelFilter,
  setModelFilter,
  page,
  setPage,
  totalPages,
  totalCount,
  getInputFromRequest,
  getOutputFromResponse,
}: {
  traces: Trace[];
  models: string[];
  modelFilter: string | undefined;
  setModelFilter: (v: string | undefined) => void;
  page: number;
  setPage: (p: number) => void;
  totalPages: number;
  totalCount: number;
  getInputFromRequest: (req: Record<string, unknown>) => string;
  getOutputFromResponse: (res: Record<string, unknown> | null) => string;
}) {
  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select
            value={modelFilter || "all"}
            onValueChange={(v) => {
              setModelFilter(v === "all" ? undefined : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Models</SelectItem>
              {models.map((model) => (
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground">
          {totalCount} trace{totalCount !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Model</TableHead>
              <TableHead className="max-w-[200px]">Input</TableHead>
              <TableHead className="max-w-[200px]">Output</TableHead>
              <TableHead>Tokens</TableHead>
              <TableHead>Latency</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {traces.map((trace) => (
              <TableRow key={trace.id}>
                <TableCell className="font-mono text-xs">
                  {trace.model_id}
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-sm">
                  {getInputFromRequest(trace.request).slice(0, 50)}
                  {getInputFromRequest(trace.request).length > 50 && "..."}
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-sm">
                  {getOutputFromResponse(trace.response).slice(0, 50)}
                  {getOutputFromResponse(trace.response).length > 50 && "..."}
                </TableCell>
                <TableCell className="text-sm">
                  {trace.total_tokens || "-"}
                </TableCell>
                <TableCell className="text-sm">
                  {trace.latency_ms ? `${trace.latency_ms}ms` : "-"}
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      trace.status_code === 200
                        ? "bg-green-500/20 text-green-400"
                        : trace.status_code
                        ? "bg-red-500/20 text-red-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {trace.status_code || "-"}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(trace.created_at), {
                    addSuffix: true,
                  })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Traces;
