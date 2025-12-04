import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import {
  Upload,
  Sparkles,
  Database,
  MoreHorizontal,
  Eye,
  Layers,
  Camera,
  Trash2,
  FileJson,
  Wand2,
  Link as LinkIcon,
  ArrowUpDown,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { 
  useDatasets, 
  useCreateDataset, 
  useDeleteDataset, 
  useUploadDatasetFile,
  useProjects 
} from "@/hooks/useSupabase";
import { supabase } from "@/integrations/supabase/client";
import type { DatasetStatus, SourceType } from "@/types/database";

const sourceIcons: Record<SourceType, typeof Upload> = {
  upload: FileJson,
  synthetic: Wand2,
  url: LinkIcon,
  youtube: Sparkles,
};

const Datasets = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isSyntheticModalOpen, setIsSyntheticModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadProject, setUploadProject] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [syntheticStep, setSyntheticStep] = useState(1);
  const [syntheticName, setSyntheticName] = useState("");
  const [syntheticProject, setSyntheticProject] = useState("");
  const [syntheticConfig, setSyntheticConfig] = useState({ pairsPerSource: 20, creativity: 50 });
  const [deleteDatasetInfo, setDeleteDatasetInfo] = useState<{ id: string; name: string; s3Path: string | null } | null>(null);
  const [previewData, setPreviewData] = useState<string[]>([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Hooks for data fetching and mutations
  const { datasets, loading, error, refetch } = useDatasets();
  const { projects } = useProjects();
  const { createDataset, loading: isCreating } = useCreateDataset();
  const { deleteDataset, loading: isDeleting } = useDeleteDataset();
  const { uploadFile: uploadToStorage, loading: isUploading, progress: uploadProgress } = useUploadDatasetFile();

  // Real-time subscription for dataset status changes
  useEffect(() => {
    const channel = supabase
      .channel('datasets-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'datasets',
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

  const formatNumber = (num: number | null) => {
    if (num === null) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedDatasets(checked ? (datasets?.map((d) => d.id) || []) : []);
  };

  const handleSelectDataset = (id: string, checked: boolean) => {
    setSelectedDatasets(
      checked
        ? [...selectedDatasets, id]
        : selectedDatasets.filter((did) => did !== id)
    );
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".jsonl") || file.name.endsWith(".json"))) {
      setUploadFile(file);
      setUploadName(file.name.replace(/\.(jsonl|json)$/, ""));
      loadPreview(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      setUploadName(file.name.replace(/\.(jsonl|json)$/, ""));
      loadPreview(file);
    }
  };

  const loadPreview = async (file: File) => {
    setIsPreviewLoading(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim()).slice(0, 5);
      setPreviewData(lines);
    } catch (err) {
      console.error('Error loading preview:', err);
      setPreviewData([]);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadName.trim()) return;

    // Create dataset record first
    const dataset = await createDataset(
      uploadName.trim(),
      uploadProject || null,
      'upload',
      { originalFilename: uploadFile.name, size: uploadFile.size }
    );

    if (!dataset) return;

    // Upload file to storage
    const filePath = await uploadToStorage(uploadFile, dataset.id);

    if (filePath) {
      // Update dataset with s3_path
      await supabase
        .from('datasets')
        .update({ s3_path: filePath, status: 'processing' })
        .eq('id', dataset.id);
    }

    // Reset form and close modal
    setIsUploadModalOpen(false);
    setUploadFile(null);
    setUploadName("");
    setUploadProject("");
    setPreviewData([]);
    refetch();
  };

  const handleSyntheticGenerate = async () => {
    if (!syntheticName.trim()) return;

    await createDataset(
      syntheticName.trim(),
      syntheticProject || null,
      'synthetic',
      {
        pairsPerSource: syntheticConfig.pairsPerSource,
        creativity: syntheticConfig.creativity,
      }
    );

    // Reset form and close modal
    setIsSyntheticModalOpen(false);
    setSyntheticStep(1);
    setSyntheticName("");
    setSyntheticProject("");
    setSyntheticConfig({ pairsPerSource: 20, creativity: 50 });
    refetch();
  };

  const handleDelete = async () => {
    if (!deleteDatasetInfo) return;

    const success = await deleteDataset(deleteDatasetInfo.id, deleteDatasetInfo.s3Path);

    if (success) {
      setDeleteDatasetInfo(null);
      setSelectedDatasets(prev => prev.filter(id => id !== deleteDatasetInfo.id));
      refetch();
    }
  };

  const getStatusFromString = (status: string | null): DatasetStatus => {
    const validStatuses: DatasetStatus[] = ['pending', 'processing', 'ready', 'failed'];
    if (status && validStatuses.includes(status as DatasetStatus)) {
      return status as DatasetStatus;
    }
    return 'pending';
  };

  const getSourceTypeFromString = (sourceType: string): SourceType => {
    const validTypes: SourceType[] = ['upload', 'synthetic', 'url', 'youtube'];
    if (validTypes.includes(sourceType as SourceType)) {
      return sourceType as SourceType;
    }
    return 'upload';
  };

  // Loading skeleton
  const renderSkeleton = () => (
    <div className="border border-border rounded-lg bg-card">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="w-12"><Skeleton className="h-4 w-4" /></TableHead>
            <TableHead><Skeleton className="h-4 w-24" /></TableHead>
            <TableHead><Skeleton className="h-4 w-20" /></TableHead>
            <TableHead><Skeleton className="h-4 w-16" /></TableHead>
            <TableHead><Skeleton className="h-4 w-16" /></TableHead>
            <TableHead><Skeleton className="h-4 w-20" /></TableHead>
            <TableHead><Skeleton className="h-4 w-20" /></TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[1, 2, 3, 4, 5].map((i) => (
            <TableRow key={i} className="border-border">
              <TableCell><Skeleton className="h-4 w-4" /></TableCell>
              <TableCell><Skeleton className="h-4 w-40" /></TableCell>
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-5 w-20" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-8 w-8" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  // Error state
  const renderError = () => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
      <h3 className="text-lg font-semibold text-foreground mb-2">Failed to load datasets</h3>
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
              <h1 className="text-2xl font-semibold text-foreground">Datasets</h1>
              <p className="text-muted-foreground mt-1">
                Upload, generate, and manage training datasets
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsSyntheticModalOpen(true)}
                className="gap-2 border-border text-foreground hover:bg-secondary"
              >
                <Sparkles className="h-4 w-4" />
                Generate Synthetic
              </Button>
              <Button
                onClick={() => setIsUploadModalOpen(true)}
                className="bg-primary hover:bg-primary/90 gap-2"
              >
                <Upload className="h-4 w-4" />
                Upload JSONL
              </Button>
            </div>
          </div>

          {/* Bulk Actions (when selected) */}
          {selectedDatasets.length > 0 && (
            <div className="flex items-center gap-4 p-3 bg-secondary rounded-lg border border-border animate-fade-in">
              <span className="text-sm text-foreground">
                {selectedDatasets.length} selected
              </span>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                <Layers className="h-4 w-4 mr-2" />
                Create Snapshots
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-destructive"
                onClick={() => {
                  // For bulk delete, we'd need to handle multiple
                  const firstSelected = datasets?.find(d => d.id === selectedDatasets[0]);
                  if (firstSelected) {
                    setDeleteDatasetInfo({
                      id: firstSelected.id,
                      name: firstSelected.name,
                      s3Path: firstSelected.s3_path,
                    });
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          )}

          {/* Content Area */}
          {loading ? (
            renderSkeleton()
          ) : error ? (
            renderError()
          ) : !datasets || datasets.length === 0 ? (
            <EmptyState
              icon={Database}
              title="No datasets yet"
              subtitle="Upload a JSONL file or generate synthetic data to get started"
              actionLabel="Upload Dataset"
              onAction={() => setIsUploadModalOpen(true)}
            />
          ) : (
            <div className="border border-border rounded-lg bg-card animate-fade-in animate-delay-100">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={datasets.length > 0 && selectedDatasets.length === datasets.length}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      <div className="flex items-center gap-1 cursor-pointer hover:text-foreground">
                        Name
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead className="text-muted-foreground">Project</TableHead>
                    <TableHead className="text-muted-foreground text-right">Rows</TableHead>
                    <TableHead className="text-muted-foreground text-right">Tokens</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground">Created</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datasets.map((dataset) => {
                    const SourceIcon = sourceIcons[getSourceTypeFromString(dataset.source_type)] || FileJson;
                    const project = projects?.find(p => p.id === dataset.project_id);
                    return (
                      <TableRow
                        key={dataset.id}
                        className="border-border hover:bg-secondary/50"
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedDatasets.includes(dataset.id)}
                            onCheckedChange={(checked) =>
                              handleSelectDataset(dataset.id, !!checked)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <SourceIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-foreground">
                              {dataset.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {project ? (
                            <Link
                              to={`/dashboard/projects/${dataset.project_id}`}
                              className="text-info hover:underline"
                            >
                              {project.name}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-foreground">
                          {formatNumber(dataset.row_count)}
                        </TableCell>
                        <TableCell className="text-right text-foreground">
                          {formatNumber(dataset.total_tokens)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={getStatusFromString(dataset.status)} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(dataset.created_at)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover">
                              <DropdownMenuItem className="cursor-pointer">
                                <Eye className="mr-2 h-4 w-4" />
                                View
                              </DropdownMenuItem>
                              <DropdownMenuItem className="cursor-pointer">
                                <Sparkles className="mr-2 h-4 w-4" />
                                Enrich
                              </DropdownMenuItem>
                              <DropdownMenuItem className="cursor-pointer">
                                <Camera className="mr-2 h-4 w-4" />
                                Create Snapshot
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="cursor-pointer text-destructive"
                                onClick={() => setDeleteDatasetInfo({
                                  id: dataset.id,
                                  name: dataset.name,
                                  s3Path: dataset.s3_path,
                                })}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </main>
      </div>

      {/* Upload JSONL Modal */}
      <Dialog open={isUploadModalOpen} onOpenChange={(open) => {
        setIsUploadModalOpen(open);
        if (!open) {
          setUploadFile(null);
          setUploadName("");
          setUploadProject("");
          setPreviewData([]);
        }
      }}>
        <DialogContent className="bg-card border-border sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-foreground">Upload JSONL Dataset</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Upload a JSONL file containing conversation data
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground",
                uploadFile && "border-success bg-success/5"
              )}
            >
              {uploadFile ? (
                <div className="flex items-center justify-center gap-2">
                  <FileJson className="h-8 w-8 text-success" />
                  <div className="text-left">
                    <p className="font-medium text-foreground">{uploadFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-foreground mb-1">
                    Drag and drop your file here
                  </p>
                  <p className="text-sm text-muted-foreground mb-3">
                    or click to browse
                  </p>
                  <input
                    type="file"
                    accept=".jsonl,.json"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload">
                    <Button variant="outline" className="border-border" asChild>
                      <span>Browse Files</span>
                    </Button>
                  </label>
                  <p className="text-xs text-muted-foreground mt-3">
                    Accepts .jsonl files up to 100MB
                  </p>
                </>
              )}
            </div>

            {/* Preview */}
            {previewData.length > 0 && (
              <div className="space-y-2">
                <Label className="text-foreground">Preview (first 5 rows)</Label>
                <div className="bg-secondary rounded-lg p-3 max-h-32 overflow-auto">
                  {isPreviewLoading ? (
                    <Skeleton className="h-20 w-full" />
                  ) : (
                    <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">
                      {previewData.map((line, i) => (
                        <div key={i} className="truncate">{line.slice(0, 100)}...</div>
                      ))}
                    </pre>
                  )}
                </div>
              </div>
            )}

            {uploadFile && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="dataset-name" className="text-foreground">
                    Dataset Name
                  </Label>
                  <Input
                    id="dataset-name"
                    value={uploadName}
                    onChange={(e) => setUploadName(e.target.value)}
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Link to Project (optional)</Label>
                  <Select value={uploadProject} onValueChange={setUploadProject}>
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {projects?.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Upload Progress */}
                {isUploading && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Uploading...</span>
                      <span className="text-foreground">{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setIsUploadModalOpen(false);
                setUploadFile(null);
                setUploadName("");
                setUploadProject("");
                setPreviewData([]);
              }}
              className="text-muted-foreground"
              disabled={isUploading || isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!uploadFile || !uploadName.trim() || isUploading || isCreating}
              className="bg-primary hover:bg-primary/90"
            >
              {isUploading || isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isUploading ? "Uploading..." : "Creating..."}
                </>
              ) : (
                "Upload"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Synthetic Modal */}
      <Dialog open={isSyntheticModalOpen} onOpenChange={(open) => {
        setIsSyntheticModalOpen(open);
        if (!open) {
          setSyntheticStep(1);
          setSyntheticName("");
          setSyntheticProject("");
          setSyntheticConfig({ pairsPerSource: 20, creativity: 50 });
        }
      }}>
        <DialogContent className="bg-card border-border sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Generate Synthetic Dataset
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Step {syntheticStep} of 3 -{" "}
              {syntheticStep === 1
                ? "Name & Project"
                : syntheticStep === 2
                ? "Configure Generation"
                : "Review & Generate"}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {syntheticStep === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="synthetic-name" className="text-foreground">
                    Dataset Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="synthetic-name"
                    placeholder="e.g., product-knowledge-qa"
                    value={syntheticName}
                    onChange={(e) => setSyntheticName(e.target.value)}
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Link to Project (optional)</Label>
                  <Select value={syntheticProject} onValueChange={setSyntheticProject}>
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {projects?.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  {[
                    { icon: FileJson, label: "Files", desc: "PDF, DOCX, TXT" },
                    { icon: LinkIcon, label: "Website", desc: "Scrape web pages" },
                  ].map((source) => (
                    <button
                      key={source.label}
                      className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors"
                    >
                      <source.icon className="h-8 w-8 text-muted-foreground" />
                      <span className="font-medium text-foreground">{source.label}</span>
                      <span className="text-xs text-muted-foreground">{source.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {syntheticStep === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-foreground">QA Pairs per Source</Label>
                  <Input 
                    type="number" 
                    value={syntheticConfig.pairsPerSource}
                    onChange={(e) => setSyntheticConfig(prev => ({ ...prev, pairsPerSource: parseInt(e.target.value) || 20 }))}
                    className="bg-secondary border-border" 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Creativity Level: {syntheticConfig.creativity}%</Label>
                  <Input 
                    type="range" 
                    min={0} 
                    max={100} 
                    value={syntheticConfig.creativity}
                    onChange={(e) => setSyntheticConfig(prev => ({ ...prev, creativity: parseInt(e.target.value) }))}
                    className="w-full" 
                  />
                </div>
              </div>
            )}

            {syntheticStep === 3 && (
              <div className="space-y-4">
                <div className="p-4 bg-secondary rounded-lg space-y-2">
                  <p className="text-sm text-foreground"><strong>Name:</strong> {syntheticName}</p>
                  <p className="text-sm text-muted-foreground">QA Pairs per Source: {syntheticConfig.pairsPerSource}</p>
                  <p className="text-sm text-muted-foreground">Creativity: {syntheticConfig.creativity}%</p>
                  <p className="text-sm text-muted-foreground">Status: Will be set to "pending" for processing</p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                if (syntheticStep === 1) {
                  setIsSyntheticModalOpen(false);
                  setSyntheticName("");
                  setSyntheticProject("");
                } else {
                  setSyntheticStep(syntheticStep - 1);
                }
              }}
              className="text-muted-foreground"
              disabled={isCreating}
            >
              {syntheticStep === 1 ? "Cancel" : "Back"}
            </Button>
            <Button
              onClick={() => {
                if (syntheticStep < 3) {
                  setSyntheticStep(syntheticStep + 1);
                } else {
                  handleSyntheticGenerate();
                }
              }}
              disabled={(syntheticStep === 1 && !syntheticName.trim()) || isCreating}
              className="bg-primary hover:bg-primary/90"
            >
              {syntheticStep === 3 ? (
                isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Generate"
                )
              ) : (
                "Next"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDatasetInfo} onOpenChange={(open) => !open && setDeleteDatasetInfo(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete Dataset</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete "{deleteDatasetInfo?.name}"? This action cannot be undone.
              The dataset file will also be removed from storage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary border-border text-foreground">
              Cancel
            </AlertDialogCancel>
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
                "Delete Dataset"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Datasets;
