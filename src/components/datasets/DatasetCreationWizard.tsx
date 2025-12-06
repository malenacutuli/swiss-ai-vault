import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
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
import { cn } from "@/lib/utils";
import {
  Upload,
  Sparkles,
  FileText,
  Youtube,
  Globe,
  Layers,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  FileJson,
  AlertCircle,
  X,
  ChevronRight,
  FileUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type CreationMethod = "upload" | "synthetic" | "huggingface";
type SyntheticSource = "files" | "youtube" | "web" | "mixed";

interface Project {
  id: string;
  name: string;
}

interface DatasetCreationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  onSuccess: () => void;
}

const STEPS = [
  { id: 1, title: "Choose Method", description: "Select how to create your dataset" },
  { id: 2, title: "Q/A Format", description: "Define question and answer format" },
  { id: 3, title: "Generate", description: "Configure and create dataset" },
];

const CREATION_METHODS = [
  {
    id: "upload" as CreationMethod,
    title: "Upload File",
    description: "Upload a JSONL file with conversation datapoints",
    icon: Upload,
    available: true,
  },
  {
    id: "synthetic" as CreationMethod,
    title: "Synthetic Data",
    description: "Generate from files, URLs, or YouTube videos",
    icon: Sparkles,
    available: true,
  },
  {
    id: "huggingface" as CreationMethod,
    title: "Import from Hugging Face",
    description: "Import existing datasets from HF Hub",
    icon: FileJson,
    available: true,
  },
];

const SYNTHETIC_SOURCES = [
  {
    id: "files" as SyntheticSource,
    title: "Files Only",
    description: "PDF, DOCX, TXT, HTML, PPTX",
    icon: FileText,
  },
  {
    id: "youtube" as SyntheticSource,
    title: "YouTube Videos",
    description: "Videos & Playlists",
    icon: Youtube,
  },
  {
    id: "web" as SyntheticSource,
    title: "Web Scraping",
    description: "Website URLs",
    icon: Globe,
  },
  {
    id: "mixed" as SyntheticSource,
    title: "Mixed Sources",
    description: "Combine multiple types",
    icon: Layers,
  },
];

const EXAMPLE_QA_PAIRS = [
  {
    question: "What is the capital of France?",
    answer: "The capital of France is Paris. It is the largest city in France and serves as the country's political, economic, and cultural center.",
  },
  {
    question: "How does photosynthesis work?",
    answer: "Photosynthesis is the process by which plants convert sunlight, water, and carbon dioxide into glucose and oxygen. This occurs primarily in the leaves using chlorophyll.",
  },
  {
    question: "What are the benefits of regular exercise?",
    answer: "Regular exercise improves cardiovascular health, strengthens muscles, enhances mental health, boosts immune function, and helps maintain a healthy weight.",
  },
];

const JSON_SCHEMA = `{
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant."
    },
    {
      "role": "user", 
      "content": "{{question}}"
    },
    {
      "role": "assistant",
      "content": "{{answer}}"
    }
  ]
}`;

export const DatasetCreationWizard = ({
  isOpen,
  onClose,
  projects,
  onSuccess,
}: DatasetCreationWizardProps) => {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);

  // Step 1 state
  const [creationMethod, setCreationMethod] = useState<CreationMethod | null>(null);
  const [syntheticSource, setSyntheticSource] = useState<SyntheticSource | null>(null);
  const [datasetName, setDatasetName] = useState("");
  const [projectId, setProjectId] = useState("");
  
  // Upload state
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  // Synthetic state
  const [sourceContent, setSourceContent] = useState("");
  const [pairsPerSource, setPairsPerSource] = useState(20);
  
  // HuggingFace state
  const [hfDatasetId, setHfDatasetId] = useState("");
  const [hfSubset, setHfSubset] = useState("");
  const [hfSplit, setHfSplit] = useState("train");
  const [hfMaxRows, setHfMaxRows] = useState(1000);
  
  // Step 2 state
  const [questionFormat, setQuestionFormat] = useState("Generate a clear, specific question about the content.");
  const [answerFormat, setAnswerFormat] = useState("Provide a comprehensive, accurate answer based on the source material.");
  
  // Step 3 state
  const [creativity, setCreativity] = useState(50);

  const totalPairs = useMemo(() => {
    if (creationMethod === "upload") {
      return uploadFiles.length > 0 ? "Varies by file" : 0;
    }
    const sourceCount = sourceContent.split('\n').filter(s => s.trim()).length || 1;
    return sourceCount * pairsPerSource;
  }, [creationMethod, uploadFiles, sourceContent, pairsPerSource]);

  const estimatedCredits = useMemo(() => {
    if (creationMethod === "upload") return 0;
    const pairs = typeof totalPairs === "number" ? totalPairs : 100;
    return Math.max(1, Math.ceil(pairs * 0.01)); // 0.01 credits per pair
  }, [creationMethod, totalPairs]);

  const canProceed = useMemo(() => {
    if (currentStep === 1) {
      if (!creationMethod || !datasetName.trim()) return false;
      if (creationMethod === "upload") return uploadFiles.length > 0;
      if (creationMethod === "synthetic") return syntheticSource && sourceContent.trim();
      if (creationMethod === "huggingface") return hfDatasetId.trim().length > 0;
      return false;
    }
    return true;
  }, [currentStep, creationMethod, datasetName, uploadFiles, syntheticSource, sourceContent, hfDatasetId]);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => {
      const ext = f.name.toLowerCase().slice(f.name.lastIndexOf('.'));
      return ['.jsonl', '.json', '.txt'].includes(ext);
    });
    setUploadFiles(prev => [...prev, ...files].slice(0, 100));
    if (files.length > 0 && !datasetName) {
      setDatasetName(files[0].name.replace(/\.(jsonl|json|txt)$/, ""));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => {
      const ext = f.name.toLowerCase().slice(f.name.lastIndexOf('.'));
      return ['.jsonl', '.json', '.txt'].includes(ext);
    });
    setUploadFiles(prev => [...prev, ...files].slice(0, 100));
    if (files.length > 0 && !datasetName) {
      setDatasetName(files[0].name.replace(/\.(jsonl|json|txt)$/, ""));
    }
  };

  const removeFile = (index: number) => {
    setUploadFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    setIsProcessing(true);
    
    try {
      console.log('[DatasetWizard] Starting dataset creation...', { creationMethod, datasetName, projectId });
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Authentication required", variant: "destructive" });
        return;
      }

      // Fix: Handle "none" project selection properly
      const resolvedProjectId = (projectId && projectId !== 'none') ? projectId : null;
      console.log('[DatasetWizard] Resolved project_id:', resolvedProjectId);

      if (creationMethod === "upload") {
        // Handle file upload
        const file = uploadFiles[0];
        const datasetId = crypto.randomUUID();
        const filePath = `${user.id}/${datasetId}/${file.name}`;

        console.log('[DatasetWizard] Uploading file to storage:', filePath);
        const { error: uploadError } = await supabase.storage
          .from('datasets')
          .upload(filePath, file, { contentType: 'application/json' });

        if (uploadError) {
          console.error('[DatasetWizard] Storage upload failed:', uploadError);
          throw uploadError;
        }
        console.log('[DatasetWizard] Storage upload successful');

        console.log('[DatasetWizard] Inserting dataset record...');
        const { error: insertError } = await supabase
          .from('datasets')
          .insert({
            id: datasetId,
            user_id: user.id,
            project_id: resolvedProjectId,
            name: datasetName.trim(),
            source_type: 'upload',
            status: 'pending',
            s3_path: filePath,
          });

        if (insertError) {
          console.error('[DatasetWizard] Insert failed:', insertError);
          throw insertError;
        }
        console.log('[DatasetWizard] Dataset record created, invoking process-dataset...');

        await supabase.functions.invoke('process-dataset', {
          body: { dataset_id: datasetId }
        });

        toast({
          title: "Dataset uploaded",
          description: "Processing started. Status will update automatically.",
        });
      } else if (creationMethod === "synthetic") {
        // Handle synthetic generation
        const datasetId = crypto.randomUUID();

        // Auto-detect source type from content
        const detectSourceType = (content: string): 'text' | 'url' | 'youtube' => {
          const trimmed = content.trim();
          if (trimmed.includes('youtube.com/watch') || trimmed.includes('youtu.be/')) {
            return 'youtube';
          }
          if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            return 'url';
          }
          return 'text';
        };

        // Parse sources from content (each line is a source)
        const parsedSources = sourceContent
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .map(content => ({
            type: detectSourceType(content),
            content,
          }));

        console.log('[DatasetWizard] Parsed sources:', parsedSources);

        console.log('[DatasetWizard] Creating synthetic dataset record...');
        const { error: insertError } = await supabase
          .from('datasets')
          .insert({
            id: datasetId,
            user_id: user.id,
            project_id: resolvedProjectId,
            name: datasetName.trim(),
            source_type: 'synthetic',
            status: 'pending',
            source_config: {
              source_type: syntheticSource,
              content: sourceContent,
              pairs_per_source: pairsPerSource,
              question_format: questionFormat,
              answer_format: answerFormat,
              creativity,
            },
          });

        if (insertError) {
          console.error('[DatasetWizard] Insert failed:', insertError);
          throw insertError;
        }
        console.log('[DatasetWizard] Dataset record created, invoking generate-synthetic...');

        toast({
          title: "Generating synthetic data...",
          description: "This may take 30-60 seconds.",
        });

        const { data: result, error: generateError } = await supabase.functions.invoke('generate-synthetic', {
          body: {
            dataset_id: datasetId,
            sources: parsedSources.length > 0 ? parsedSources : [{ type: 'text', content: sourceContent }],
            config: {
              num_pairs: pairsPerSource,
              question_format: questionFormat,
              answer_format: answerFormat,
              creativity: creativity / 100,
            }
          }
        });

        // Check for insufficient credits (402 error)
        if (generateError) {
          console.error('[DatasetWizard] generate-synthetic error:', generateError);
          
          await supabase
            .from('datasets')
            .update({ status: 'error', error_message: generateError.message })
            .eq('id', datasetId);
          
          // Check if it's a credits error
          if (generateError.message?.includes('Insufficient') || generateError.message?.includes('402')) {
            toast({
              title: "Insufficient Credits",
              description: "Please add more credits to generate synthetic data.",
              variant: "destructive",
            });
          } else {
            throw generateError;
          }
          return;
        }

        console.log('[DatasetWizard] Synthetic generation complete:', result);
        toast({
          title: "Synthetic dataset generated!",
          description: `Created ${result?.row_count || 0} QA pairs.`,
        });
      } else if (creationMethod === "huggingface") {
        // Handle HuggingFace import
        const datasetId = crypto.randomUUID();

        console.log('[DatasetWizard] Creating HuggingFace import dataset record...');
        const { error: insertError } = await supabase
          .from('datasets')
          .insert({
            id: datasetId,
            user_id: user.id,
            project_id: resolvedProjectId,
            name: datasetName.trim(),
            source_type: 'upload', // Use 'upload' as HuggingFace imports are like uploads
            status: 'pending',
            source_config: {
              hf_dataset_id: hfDatasetId,
              subset: hfSubset || null,
              split: hfSplit,
              max_rows: hfMaxRows,
            },
          });

        if (insertError) {
          console.error('[DatasetWizard] Insert failed:', insertError);
          throw insertError;
        }
        console.log('[DatasetWizard] Dataset record created, invoking import-huggingface...');

        toast({
          title: "Importing from HuggingFace...",
          description: "This may take a moment.",
        });

        const { data: result, error: importError } = await supabase.functions.invoke('import-huggingface', {
          body: {
            dataset_id: datasetId,
            hf_dataset_id: hfDatasetId,
            subset: hfSubset || undefined,
            split: hfSplit,
            max_rows: hfMaxRows,
          }
        });

        if (importError) {
          console.error('[DatasetWizard] import-huggingface error:', importError);
          
          await supabase
            .from('datasets')
            .update({ status: 'error', error_message: importError.message })
            .eq('id', datasetId);
          
          throw importError;
        }

        console.log('[DatasetWizard] HuggingFace import complete:', result);
        toast({
          title: "Dataset imported!",
          description: `Imported ${result?.row_count || 0} rows from HuggingFace.`,
        });
      }

      onSuccess();
      handleClose();
    } catch (err) {
      const error = err as Error;
      console.error('[DatasetWizard] Error:', error);
      toast({
        title: "Error creating dataset",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setCurrentStep(1);
    setCreationMethod(null);
    setSyntheticSource(null);
    setDatasetName("");
    setProjectId("");
    setUploadFiles([]);
    setSourceContent("");
    setPairsPerSource(20);
    setCreativity(50);
    setHfDatasetId("");
    setHfSubset("");
    setHfSplit("train");
    setHfMaxRows(1000);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">Create New Dataset</DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-between px-4 py-3 bg-secondary/30 rounded-lg mb-4">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                    currentStep > step.id
                      ? "bg-success text-success-foreground"
                      : currentStep === step.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {currentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
                </div>
                <div className="hidden sm:block">
                  <p className={cn(
                    "text-sm font-medium",
                    currentStep >= step.id ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {step.title}
                  </p>
                </div>
              </div>
              {index < STEPS.length - 1 && (
                <ChevronRight className="h-4 w-4 mx-4 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto px-1">
          {/* STEP 1 */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-fade-in">
              {/* Dataset Name */}
              <div className="space-y-2">
                <Label>Dataset Name</Label>
                <Input
                  placeholder="e.g., Customer Support QA"
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                  className="bg-secondary border-border"
                />
              </div>

              {/* Project Selection */}
              <div className="space-y-2">
                <Label>Project (Optional)</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="none">No project</SelectItem>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Creation Method Selection */}
              <div className="space-y-3">
                <Label>Choose how to create dataset</Label>
                <div className="grid gap-3">
                  {CREATION_METHODS.map((method) => (
                    <Card
                      key={method.id}
                      className={cn(
                        "cursor-pointer transition-all border-2",
                        method.available ? "hover:border-primary/50" : "opacity-60 cursor-not-allowed",
                        creationMethod === method.id ? "border-primary bg-primary/5" : "border-border"
                      )}
                      onClick={() => method.available && setCreationMethod(method.id)}
                    >
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className={cn(
                          "p-3 rounded-lg",
                          creationMethod === method.id ? "bg-primary/10 text-primary" : "bg-secondary"
                        )}>
                          <method.icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-foreground">{method.title}</h3>
                            {'badge' in method && method.badge && (
                              <Badge variant="outline" className="text-xs">{String(method.badge)}</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{method.description}</p>
                        </div>
                        {creationMethod === method.id && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Upload Zone (if upload selected) */}
              {creationMethod === "upload" && (
                <div className="space-y-3 animate-fade-in">
                  <Label>Upload JSONL File</Label>
                  <div
                    className={cn(
                      "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                      isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
                    )}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleFileDrop}
                  >
                    <FileUp className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-foreground mb-1">
                      Drag and drop your file here, or{" "}
                      <label className="text-primary cursor-pointer hover:underline">
                        browse
                        <input
                          type="file"
                          className="hidden"
                          accept=".jsonl,.json,.txt"
                          onChange={handleFileSelect}
                        />
                      </label>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Supports JSONL, JSON • Max 50MB
                    </p>
                  </div>

                  {uploadFiles.length > 0 && (
                    <div className="space-y-2">
                      {uploadFiles.map((file, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                          <div className="flex items-center gap-2">
                            <FileJson className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium text-foreground">{file.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => removeFile(i)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Synthetic Source Selection */}
              {creationMethod === "synthetic" && (
                <div className="space-y-4 animate-fade-in">
                  <Label>Select Data Source</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {SYNTHETIC_SOURCES.map((source) => (
                      <Card
                        key={source.id}
                        className={cn(
                          "cursor-pointer transition-all border-2",
                          syntheticSource === source.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                        )}
                        onClick={() => setSyntheticSource(source.id)}
                      >
                        <CardContent className="p-4 flex items-center gap-3">
                          <source.icon className={cn(
                            "h-5 w-5",
                            syntheticSource === source.id ? "text-primary" : "text-muted-foreground"
                          )} />
                          <div>
                            <p className="font-medium text-sm text-foreground">{source.title}</p>
                            <p className="text-xs text-muted-foreground">{source.description}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {syntheticSource && (
                    <div className="space-y-3 animate-fade-in">
                      <Label>
                        {syntheticSource === "web" ? "Enter URLs (one per line)" : 
                         syntheticSource === "youtube" ? "Enter YouTube URLs (one per line)" :
                         "Enter content or paste text"}
                      </Label>
                      <Textarea
                        placeholder={
                          syntheticSource === "web" 
                            ? "https://example.com/page1\nhttps://example.com/page2" 
                            : syntheticSource === "youtube"
                            ? "https://youtube.com/watch?v=..."
                            : "Paste your source text here..."
                        }
                        value={sourceContent}
                        onChange={(e) => setSourceContent(e.target.value)}
                        className="min-h-[120px] bg-secondary border-border"
                      />
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>QA Pairs per Source</Label>
                          <span className="text-sm text-muted-foreground">{pairsPerSource}</span>
                        </div>
                        <Slider
                          value={[pairsPerSource]}
                          onValueChange={([v]) => setPairsPerSource(v)}
                          min={1}
                          max={100}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>1</span>
                          <span>100</span>
                        </div>
                      </div>

                      <div className="p-3 bg-info/10 border border-info/30 rounded-lg">
                        <p className="text-sm text-info">
                          <strong>Total QA Pairs:</strong> {totalPairs}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* HuggingFace Import Section */}
              {creationMethod === "huggingface" && (
                <div className="space-y-4 animate-fade-in">
                  <div className="space-y-2">
                    <Label>HuggingFace Dataset ID</Label>
                    <Input
                      placeholder="e.g., tatsu-lab/alpaca, openai/gsm8k"
                      value={hfDatasetId}
                      onChange={(e) => setHfDatasetId(e.target.value)}
                      className="bg-secondary border-border"
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter the full dataset ID from HuggingFace Hub
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Subset (Optional)</Label>
                      <Input
                        placeholder="e.g., main, default"
                        value={hfSubset}
                        onChange={(e) => setHfSubset(e.target.value)}
                        className="bg-secondary border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Split</Label>
                      <Select value={hfSplit} onValueChange={setHfSplit}>
                        <SelectTrigger className="bg-secondary border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover">
                          <SelectItem value="train">Train</SelectItem>
                          <SelectItem value="test">Test</SelectItem>
                          <SelectItem value="validation">Validation</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Max Rows to Import</Label>
                      <span className="text-sm text-muted-foreground">{hfMaxRows.toLocaleString()}</span>
                    </div>
                    <Slider
                      value={[hfMaxRows]}
                      onValueChange={([v]) => setHfMaxRows(v)}
                      min={100}
                      max={10000}
                      step={100}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>100</span>
                      <span>10,000</span>
                    </div>
                  </div>

                  <div className="p-3 bg-info/10 border border-info/30 rounded-lg">
                    <p className="text-sm text-info">
                      <strong>Supported formats:</strong> instruction/output, question/answer, prompt/completion, messages, conversations
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2 */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-fade-in">
              <Tabs defaultValue="examples" className="w-full">
                <TabsList className="bg-secondary border border-border w-full">
                  <TabsTrigger value="examples" className="flex-1">Examples</TabsTrigger>
                  <TabsTrigger value="format" className="flex-1">Format</TabsTrigger>
                </TabsList>

                <TabsContent value="examples" className="mt-4 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Sample Q/A pairs that will be generated from your source:
                  </p>
                  {EXAMPLE_QA_PAIRS.map((pair, i) => (
                    <Card key={i} className="bg-secondary/30 border-border">
                      <CardContent className="p-4 space-y-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Question</Label>
                          <p className="text-sm text-foreground">{pair.question}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Answer</Label>
                          <p className="text-sm text-foreground">{pair.answer}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>

                <TabsContent value="format" className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <Label>Question Format Template</Label>
                    <Textarea
                      value={questionFormat}
                      onChange={(e) => setQuestionFormat(e.target.value)}
                      className="min-h-[80px] bg-secondary border-border"
                      placeholder="Describe how questions should be formatted..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Answer Format Template</Label>
                    <Textarea
                      value={answerFormat}
                      onChange={(e) => setAnswerFormat(e.target.value)}
                      className="min-h-[80px] bg-secondary border-border"
                      placeholder="Describe how answers should be formatted..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>JSON Schema</Label>
                    <pre className="p-4 bg-secondary rounded-lg text-xs text-muted-foreground overflow-x-auto">
                      {JSON_SCHEMA}
                    </pre>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* STEP 3 */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-fade-in">
              {/* Summary */}
              <Card className="bg-secondary/30 border-border">
                <CardContent className="p-4 space-y-3">
                  <h3 className="font-medium text-foreground">Data Sources Summary</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Method</p>
                      <p className="font-medium text-foreground capitalize">{creationMethod}</p>
                    </div>
                    {creationMethod === "upload" && (
                      <div>
                        <p className="text-muted-foreground">Files</p>
                        <p className="font-medium text-foreground">{uploadFiles.length} file(s)</p>
                      </div>
                    )}
                    {creationMethod === "synthetic" && (
                      <>
                        <div>
                          <p className="text-muted-foreground">Source Type</p>
                          <p className="font-medium text-foreground capitalize">{syntheticSource}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Pairs per Source</p>
                          <p className="font-medium text-foreground">{pairsPerSource}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total QA Pairs</p>
                          <p className="font-medium text-foreground">{totalPairs}</p>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Creativity Slider (for synthetic only) */}
              {creationMethod === "synthetic" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Creativity Level</Label>
                    <span className="text-sm text-muted-foreground">{creativity}%</span>
                  </div>
                  <Slider
                    value={[creativity]}
                    onValueChange={([v]) => setCreativity(v)}
                    min={0}
                    max={100}
                    step={1}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Precise (0%)</span>
                    <span>Creative (100%)</span>
                  </div>
                </div>
              )}

              {/* Cost Summary */}
              <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/30">
                <CardContent className="p-4 space-y-3">
                  <h3 className="font-medium text-foreground">Cost Summary</h3>
                  <div className="space-y-2 text-sm">
                    {creationMethod === "upload" ? (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Processing Cost</span>
                        <span className="font-medium text-foreground">Free</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Fixed Cost</span>
                          <span className="font-medium text-foreground">1 credit</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Variable Cost</span>
                          <span className="font-medium text-foreground">~{estimatedCredits - 1} credits</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-border">
                          <span className="text-foreground font-medium">Estimated Total</span>
                          <span className="font-semibold text-primary">{estimatedCredits}+ credits</span>
                        </div>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Additional processing fees may apply for large datasets.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
          <Button
            variant="outline"
            onClick={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : handleClose()}
            disabled={isProcessing}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {currentStep === 1 ? "Cancel" : "Back"}
          </Button>

          {currentStep < 3 ? (
            <Button
              onClick={() => {
                // Skip step 2 for upload and huggingface methods
                if ((creationMethod === "upload" || creationMethod === "huggingface") && currentStep === 1) {
                  handleCreate();
                } else {
                  setCurrentStep(currentStep + 1);
                }
              }}
              disabled={!canProceed}
              className="gap-2"
            >
              {(creationMethod === "upload" || creationMethod === "huggingface") && currentStep === 1 ? (
                isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {creationMethod === "huggingface" ? "Importing..." : "Creating..."}
                  </>
                ) : (
                  <>{creationMethod === "huggingface" ? "Import Dataset" : "Create Dataset"}</>
                )
              ) : (
                <>
                  Next
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleCreate}
              disabled={isProcessing || !canProceed}
              className="gap-2 bg-primary"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>Create Dataset</>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
