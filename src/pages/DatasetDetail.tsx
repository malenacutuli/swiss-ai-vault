import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useDataset, useUpdateDataset, useDeleteDataset, useProject } from "@/hooks/useSupabase";
import {
  ArrowLeft,
  Calendar,
  Database,
  FileJson,
  Trash2,
  Layers,
  ExternalLink,
  Pencil,
  Check,
  X,
  RefreshCw,
  Loader2,
  Play,
  AlertCircle,
  Wand2,
  Upload,
  Link as LinkIcon,
  FolderOpen,
  Code,
  Table as TableIcon,
} from "lucide-react";
import type { DatasetStatus, SourceType } from "@/types/database";

interface ParsedMessage {
  role: string;
  content: string;
}

interface ParsedRow {
  messages: ParsedMessage[];
}

const DatasetDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);
  const [snapshotName, setSnapshotName] = useState("");
  const [trainSplit, setTrainSplit] = useState([90]);
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [previewData, setPreviewData] = useState<ParsedRow[]>([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewView, setPreviewView] = useState<"table" | "json">("table");
  const [deleteSnapshotId, setDeleteSnapshotId] = useState<string | null>(null);

  const { dataset, snapshots, loading, error, refetch } = useDataset(id);
  const { updateDataset, loading: isUpdating } = useUpdateDataset();
  const { deleteDataset, loading: isDeleting } = useDeleteDataset();
  const { project } = useProject(dataset?.project_id ?? undefined);

  // Initialize edited name when dataset loads
  useEffect(() => {
    if (dataset?.name) {
      setEditedName(dataset.name);
    }
  }, [dataset?.name]);

  // Fetch preview data from storage
  useEffect(() => {
    const fetchPreview = async () => {
      if (!dataset?.s3_path) return;
      
      setIsPreviewLoading(true);
      try {
        const { data, error } = await supabase.storage
          .from('datasets')
          .download(dataset.s3_path);
        
        if (error) throw error;
        
        const text = await data.text();
        const lines = text.split('\n').filter(line => line.trim()).slice(0, 20);
        const parsedRows: ParsedRow[] = lines.map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return { messages: [] };
          }
        });
        setPreviewData(parsedRows);
      } catch (err) {
        console.error('Error fetching preview:', err);
        setPreviewData([]);
      } finally {
        setIsPreviewLoading(false);
      }
    };

    if (dataset?.s3_path && dataset?.status === 'ready') {
      fetchPreview();
    }
  }, [dataset?.s3_path, dataset?.status]);

  const handleSaveName = async () => {
    if (!dataset || !editedName.trim()) return;
    
    const result = await updateDataset(dataset.id, { name: editedName.trim() });
    if (result) {
      setIsEditingName(false);
      toast({ title: "Dataset name updated" });
      refetch();
    }
  };

  const handleDelete = async () => {
    if (!dataset) return;
    
    const success = await deleteDataset(dataset.id, dataset.s3_path);
    if (success) {
      navigate('/dashboard/datasets');
    }
  };

  const handleReprocess = async () => {
    if (!dataset) return;
    
    setIsReprocessing(true);
    try {
      // Reset status to pending
      await updateDataset(dataset.id, { status: 'pending' as const, error_message: null });
      
      // Call process-dataset Edge Function
      const { error } = await supabase.functions.invoke('process-dataset', {
        body: { dataset_id: dataset.id }
      });
      
      if (error) throw error;
      
      toast({ title: "Reprocessing started" });
      refetch();
    } catch (err) {
      toast({
        title: "Reprocessing failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive"
      });
    } finally {
      setIsReprocessing(false);
    }
  };

  const handleCreateSnapshot = async () => {
    if (!dataset || !snapshotName.trim()) return;
    
    setIsCreatingSnapshot(true);
    try {
      const trainPct = trainSplit[0] / 100;
      const rowCount = dataset.row_count || 0;
      const trainRows = Math.floor(rowCount * trainPct);
      const valRows = rowCount - trainRows;
      
      // Get next version number
      const maxVersion = snapshots.length > 0 ? Math.max(...snapshots.map(s => s.version)) : 0;
      
      const { error } = await supabase
        .from('dataset_snapshots')
        .insert({
          dataset_id: dataset.id,
          name: snapshotName.trim(),
          version: maxVersion + 1,
          row_count: rowCount,
          train_row_count: trainRows,
          val_row_count: valRows,
          train_split_pct: trainPct,
          s3_path: dataset.s3_path || '',
        });
      
      if (error) throw error;
      
      toast({ title: "Snapshot created successfully" });
      setIsSnapshotModalOpen(false);
      setSnapshotName("");
      setTrainSplit([90]);
      refetch();
    } catch (err) {
      toast({
        title: "Failed to create snapshot",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive"
      });
    } finally {
      setIsCreatingSnapshot(false);
    }
  };

  const handleDeleteSnapshot = async () => {
    if (!deleteSnapshotId) return;
    
    try {
      const { error } = await supabase
        .from('dataset_snapshots')
        .delete()
        .eq('id', deleteSnapshotId);
      
      if (error) throw error;
      
      toast({ title: "Snapshot deleted" });
      setDeleteSnapshotId(null);
      refetch();
    } catch (err) {
      toast({
        title: "Failed to delete snapshot",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive"
      });
    }
  };

  const formatBytes = (bytes: number | null | undefined) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const formatNumber = (num: number | null) => {
    if (num === null || num === undefined) return '—';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusFromString = (status: string | null): DatasetStatus => {
    const validStatuses: DatasetStatus[] = ['pending', 'processing', 'ready', 'failed'];
    if (status && validStatuses.includes(status as DatasetStatus)) {
      return status as DatasetStatus;
    }
    return 'pending';
  };

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'upload': return FileJson;
      case 'synthetic': return Wand2;
      case 'url': return LinkIcon;
      default: return Upload;
    }
  };

  const getSourceLabel = (sourceType: string) => {
    switch (sourceType) {
      case 'upload': return 'File Upload';
      case 'synthetic': return 'Synthetic';
      case 'enriched': return 'Enriched';
      case 'merged': return 'Merged';
      default: return sourceType;
    }
  };

  const getMessageByRole = (messages: ParsedMessage[], role: string) => {
    return messages.find(m => m.role === role)?.content || '—';
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

  if (error || !dataset) {
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
              <h3 className="text-lg font-semibold text-foreground mb-2">Dataset not found</h3>
              <p className="text-muted-foreground mb-4">
                {error?.message || "The dataset you're looking for doesn't exist or you don't have access."}
              </p>
              <Button onClick={() => navigate('/dashboard/datasets')} variant="outline">
                Back to Datasets
              </Button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const SourceIcon = getSourceIcon(dataset.source_type);
  const sourceConfig = dataset.source_config as { originalFilename?: string; size?: number } | null;
  const fileSize = sourceConfig?.size;

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
                  <Link to="/dashboard/datasets">Datasets</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{dataset.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Header */}
          <div className="flex flex-col gap-4 animate-fade-in">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard/datasets')}
              className="w-fit"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Datasets
            </Button>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <SourceIcon className="h-8 w-8 text-primary" />
                </div>
                <div className="flex items-center gap-2">
                  {isEditingName ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        className="h-9 w-64 bg-secondary border-border"
                        autoFocus
                      />
                      <Button size="icon" variant="ghost" onClick={handleSaveName} disabled={isUpdating}>
                        <Check className="h-4 w-4 text-success" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => {
                        setIsEditingName(false);
                        setEditedName(dataset.name);
                      }}>
                        <X className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <h1 className="text-2xl font-semibold text-foreground">{dataset.name}</h1>
                      <Button size="icon" variant="ghost" onClick={() => setIsEditingName(true)}>
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={getStatusFromString(dataset.status)} />
                <Badge variant="secondary" className="gap-1">
                  <SourceIcon className="h-3 w-3" />
                  {getSourceLabel(dataset.source_type)}
                </Badge>
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={() => setIsSnapshotModalOpen(true)}
                disabled={dataset.status !== 'ready'}
              >
                <Layers className="mr-2 h-4 w-4" />
                Create Snapshot
              </Button>
              <Button 
                variant="destructive"
                onClick={() => setIsDeleteDialogOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>

          {/* Error State */}
          {dataset.status === 'error' && dataset.error_message && (
            <Card className="border-destructive bg-destructive/10 animate-fade-in">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <AlertCircle className="h-6 w-6 text-destructive flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-destructive mb-1">Processing Error</h3>
                    <p className="text-sm text-destructive/80 mb-4">{dataset.error_message}</p>
                    <Button 
                      variant="outline" 
                      onClick={handleReprocess}
                      disabled={isReprocessing}
                      className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      {isReprocessing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Reprocessing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Reprocess
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-3 animate-fade-in animate-delay-100">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Data Preview */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-foreground">Data Preview</CardTitle>
                      <CardDescription>First 20 rows of the dataset</CardDescription>
                    </div>
                    <Tabs value={previewView} onValueChange={(v) => setPreviewView(v as "table" | "json")}>
                      <TabsList className="bg-secondary">
                        <TabsTrigger value="table" className="gap-2">
                          <TableIcon className="h-4 w-4" />
                          Table
                        </TabsTrigger>
                        <TabsTrigger value="json" className="gap-2">
                          <Code className="h-4 w-4" />
                          JSON
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </CardHeader>
                <CardContent>
                  {dataset.status !== 'ready' ? (
                    <div className="flex items-center justify-center py-12 text-muted-foreground">
                      <Database className="h-8 w-8 mr-3" />
                      <span>Dataset is not ready for preview</span>
                    </div>
                  ) : isPreviewLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : previewData.length === 0 ? (
                    <div className="flex items-center justify-center py-12 text-muted-foreground">
                      <Database className="h-8 w-8 mr-3" />
                      <span>No data available</span>
                    </div>
                  ) : previewView === "table" ? (
                    <div className="border border-border rounded-lg overflow-auto max-h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border">
                            <TableHead className="text-muted-foreground w-16">#</TableHead>
                            <TableHead className="text-muted-foreground">System</TableHead>
                            <TableHead className="text-muted-foreground">User</TableHead>
                            <TableHead className="text-muted-foreground">Assistant</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewData.map((row, i) => (
                            <TableRow key={i} className="border-border">
                              <TableCell className="text-muted-foreground font-mono text-xs">
                                {i + 1}
                              </TableCell>
                              <TableCell className="text-foreground text-sm max-w-[200px] truncate">
                                {getMessageByRole(row.messages || [], 'system')}
                              </TableCell>
                              <TableCell className="text-foreground text-sm max-w-[200px] truncate">
                                {getMessageByRole(row.messages || [], 'user')}
                              </TableCell>
                              <TableCell className="text-foreground text-sm max-w-[200px] truncate">
                                {getMessageByRole(row.messages || [], 'assistant')}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="bg-[#1e1e2e] rounded-lg p-4 overflow-auto max-h-[500px]">
                      <pre className="text-sm font-mono text-gray-100">
                        {previewData.map((row, i) => (
                          <div key={i} className="mb-2 pb-2 border-b border-gray-700 last:border-0">
                            {JSON.stringify(row, null, 2)}
                          </div>
                        ))}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Snapshots */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-foreground">Snapshots</CardTitle>
                      <CardDescription>
                        Versioned copies of this dataset for training
                      </CardDescription>
                    </div>
                    <Button 
                      size="sm"
                      onClick={() => setIsSnapshotModalOpen(true)}
                      disabled={dataset.status !== 'ready'}
                    >
                      <Layers className="mr-2 h-4 w-4" />
                      Create Snapshot
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {snapshots.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Layers className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="font-medium text-foreground mb-1">No snapshots yet</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Create a snapshot to use this dataset for fine-tuning
                      </p>
                    </div>
                  ) : (
                    <div className="border border-border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border">
                            <TableHead className="text-muted-foreground">Name</TableHead>
                            <TableHead className="text-muted-foreground">Version</TableHead>
                            <TableHead className="text-muted-foreground">Train/Val Split</TableHead>
                            <TableHead className="text-muted-foreground text-right">Train Rows</TableHead>
                            <TableHead className="text-muted-foreground text-right">Val Rows</TableHead>
                            <TableHead className="text-muted-foreground">Created</TableHead>
                            <TableHead className="w-24"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {snapshots.map((snapshot) => (
                            <TableRow key={snapshot.id} className="border-border">
                              <TableCell className="font-medium text-foreground">
                                {snapshot.name}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">v{snapshot.version}</Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {Math.round((snapshot.train_split_pct || 0.9) * 100)}% / {Math.round((1 - (snapshot.train_split_pct || 0.9)) * 100)}%
                              </TableCell>
                              <TableCell className="text-right text-foreground">
                                {formatNumber(snapshot.train_row_count)}
                              </TableCell>
                              <TableCell className="text-right text-foreground">
                                {formatNumber(snapshot.val_row_count)}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {formatDate(snapshot.created_at)}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => navigate(`/dashboard/finetuning?snapshot=${snapshot.id}`)}
                                    title="Use for Fine-tuning"
                                  >
                                    <Play className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setDeleteSnapshotId(snapshot.id)}
                                    className="text-destructive hover:text-destructive"
                                  >
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
                </CardContent>
              </Card>
            </div>

            {/* Metadata Sidebar */}
            <div className="space-y-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground">Metadata</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">File Size</span>
                    <span className="text-foreground font-medium">{formatBytes(fileSize)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Rows</span>
                    <span className="text-foreground font-medium">{formatNumber(dataset.row_count)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Total Tokens</span>
                    <span className="text-foreground font-medium">{formatNumber(dataset.total_tokens)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Created</span>
                    <span className="text-foreground font-medium">{formatDate(dataset.created_at)}</span>
                  </div>
                  {project && (
                    <div className="flex items-center justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground">Project</span>
                      <Link 
                        to={`/dashboard/projects/${project.id}`}
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        <FolderOpen className="h-3 w-3" />
                        {project.name}
                      </Link>
                    </div>
                  )}
                  {dataset.s3_path && (
                    <div className="py-2">
                      <span className="text-muted-foreground text-xs block mb-1">Storage Path</span>
                      <code className="text-xs text-muted-foreground font-mono break-all">
                        {dataset.s3_path}
                      </code>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>

      {/* Create Snapshot Modal */}
      <Dialog open={isSnapshotModalOpen} onOpenChange={setIsSnapshotModalOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-foreground">Create Snapshot</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Create a versioned copy of this dataset for fine-tuning
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="snapshot-name" className="text-foreground">
                Snapshot Name
              </Label>
              <Input
                id="snapshot-name"
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                placeholder="e.g., v1-initial"
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-foreground">Train/Validation Split</Label>
                <span className="text-sm text-muted-foreground">
                  {trainSplit[0]}% / {100 - trainSplit[0]}%
                </span>
              </div>
              <Slider
                value={trainSplit}
                onValueChange={setTrainSplit}
                min={50}
                max={95}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>50%</span>
                <span>95%</span>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-secondary">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Rows</span>
                <span className="text-foreground font-medium">{formatNumber(dataset.row_count)}</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-muted-foreground">Train Rows</span>
                <span className="text-foreground font-medium">
                  {formatNumber(Math.floor((dataset.row_count || 0) * trainSplit[0] / 100))}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-muted-foreground">Validation Rows</span>
                <span className="text-foreground font-medium">
                  {formatNumber((dataset.row_count || 0) - Math.floor((dataset.row_count || 0) * trainSplit[0] / 100))}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSnapshotModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateSnapshot}
              disabled={!snapshotName.trim() || isCreatingSnapshot}
            >
              {isCreatingSnapshot ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Snapshot'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dataset Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete Dataset</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete "{dataset.name}"? This action cannot be undone and will also delete all associated snapshots.
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

      {/* Delete Snapshot Dialog */}
      <AlertDialog open={!!deleteSnapshotId} onOpenChange={() => setDeleteSnapshotId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete Snapshot</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete this snapshot? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSnapshot}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DatasetDetail;
