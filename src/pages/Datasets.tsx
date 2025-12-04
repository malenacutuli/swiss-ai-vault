import { useState } from "react";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";

type DatasetStatus = "pending" | "processing" | "ready" | "error";
type SourceType = "upload" | "synthetic" | "enriched";

interface Dataset {
  id: string;
  name: string;
  project: string;
  projectId: string;
  sourceType: SourceType;
  rows: number;
  tokens: number;
  status: DatasetStatus;
  createdAt: string;
}

const mockDatasets: Dataset[] = [
  {
    id: "1",
    name: "customer-support-v1.jsonl",
    project: "Customer Support Bot",
    projectId: "1",
    sourceType: "upload",
    rows: 15420,
    tokens: 2340000,
    status: "ready",
    createdAt: "2024-01-18",
  },
  {
    id: "2",
    name: "sales-faq-synthetic",
    project: "Sales Assistant",
    projectId: "3",
    sourceType: "synthetic",
    rows: 5000,
    tokens: 890000,
    status: "ready",
    createdAt: "2024-01-20",
  },
  {
    id: "3",
    name: "legal-docs-enriched",
    project: "Legal Document Analyzer",
    projectId: "2",
    sourceType: "enriched",
    rows: 3200,
    tokens: 1560000,
    status: "processing",
    createdAt: "2024-01-22",
  },
  {
    id: "4",
    name: "code-reviews.jsonl",
    project: "Code Review Helper",
    projectId: "4",
    sourceType: "upload",
    rows: 8750,
    tokens: 4200000,
    status: "ready",
    createdAt: "2024-01-19",
  },
  {
    id: "5",
    name: "product-knowledge",
    project: "Sales Assistant",
    projectId: "3",
    sourceType: "synthetic",
    rows: 0,
    tokens: 0,
    status: "pending",
    createdAt: "2024-01-23",
  },
];

const sourceIcons: Record<SourceType, typeof Upload> = {
  upload: FileJson,
  synthetic: Wand2,
  enriched: Sparkles,
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

  const formatNumber = (num: number) => {
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
    setSelectedDatasets(checked ? mockDatasets.map((d) => d.id) : []);
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
    if (file && file.name.endsWith(".jsonl")) {
      setUploadFile(file);
      setUploadName(file.name.replace(".jsonl", ""));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      setUploadName(file.name.replace(".jsonl", ""));
    }
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
              <Button variant="ghost" size="sm" className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          )}

          {/* Datasets Table */}
          {mockDatasets.length === 0 ? (
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
                        checked={selectedDatasets.length === mockDatasets.length}
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
                  {mockDatasets.map((dataset) => {
                    const SourceIcon = sourceIcons[dataset.sourceType];
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
                          <a
                            href={`/dashboard/projects/${dataset.projectId}`}
                            className="text-info hover:underline"
                          >
                            {dataset.project}
                          </a>
                        </TableCell>
                        <TableCell className="text-right text-foreground">
                          {formatNumber(dataset.rows)}
                        </TableCell>
                        <TableCell className="text-right text-foreground">
                          {formatNumber(dataset.tokens)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={dataset.status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(dataset.createdAt)}
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
                              <DropdownMenuItem className="cursor-pointer text-destructive">
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
      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
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
                    accept=".jsonl"
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
                  <Label className="text-foreground">Link to Project</Label>
                  <Select value={uploadProject} onValueChange={setUploadProject}>
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="1">Customer Support Bot</SelectItem>
                      <SelectItem value="2">Legal Document Analyzer</SelectItem>
                      <SelectItem value="3">Sales Assistant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
              }}
              className="text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              disabled={!uploadFile || !uploadName}
              className="bg-primary hover:bg-primary/90"
            >
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Synthetic Modal */}
      <Dialog open={isSyntheticModalOpen} onOpenChange={(open) => {
        setIsSyntheticModalOpen(open);
        if (!open) setSyntheticStep(1);
      }}>
        <DialogContent className="bg-card border-border sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Generate Synthetic Dataset
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Step {syntheticStep} of 3 -{" "}
              {syntheticStep === 1
                ? "Select Source"
                : syntheticStep === 2
                ? "Configure Generation"
                : "Review & Generate"}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {syntheticStep === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
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
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-foreground">Drop files here or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports PDF, DOCX, TXT up to 50MB
                  </p>
                </div>
              </div>
            )}

            {syntheticStep === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-foreground">QA Pairs per Source</Label>
                  <Input type="number" defaultValue={20} className="bg-secondary border-border" />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Creativity Level</Label>
                  <Input type="range" min={0} max={100} defaultValue={50} className="w-full" />
                </div>
              </div>
            )}

            {syntheticStep === 3 && (
              <div className="space-y-4">
                <div className="p-4 bg-secondary rounded-lg">
                  <p className="text-sm text-muted-foreground">Source Files: 3 documents</p>
                  <p className="text-sm text-muted-foreground">QA Pairs: ~60 estimated</p>
                  <p className="text-sm text-muted-foreground">Estimated Cost: $2.50</p>
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
                } else {
                  setSyntheticStep(syntheticStep - 1);
                }
              }}
              className="text-muted-foreground"
            >
              {syntheticStep === 1 ? "Cancel" : "Back"}
            </Button>
            <Button
              onClick={() => {
                if (syntheticStep < 3) {
                  setSyntheticStep(syntheticStep + 1);
                } else {
                  setIsSyntheticModalOpen(false);
                  setSyntheticStep(1);
                }
              }}
              className="bg-primary hover:bg-primary/90"
            >
              {syntheticStep === 3 ? "Generate" : "Next"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Datasets;
