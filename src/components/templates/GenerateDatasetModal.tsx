import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Loader2, CheckCircle, XCircle, AlertTriangle, ArrowRight } from "@/icons";
import { SwissIconTile } from "@/components/ui/swiss";
import { getDomainIcon } from "@/lib/domain-icons";
import { useFinetuningTemplate, type FinetuningTemplate } from "@/hooks/useFinetuningTemplates";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithRetry, getEdgeFunctionErrorMessage } from '@/lib/edgeFunctionRetry';

interface GenerateDatasetModalProps {
  templateId: string | null;
  onClose: () => void;
}

type GenerationStatus = "idle" | "generating" | "success" | "error";

export const GenerateDatasetModal = ({ templateId, onClose }: GenerateDatasetModalProps) => {
  const { data: template, isLoading: templateLoading } = useFinetuningTemplate(templateId);
  const [numExamples, setNumExamples] = useState(50);
  const [variation, setVariation] = useState<"low" | "medium" | "high">("medium");
  const [topics, setTopics] = useState("");
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createdDatasetId, setCreatedDatasetId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Reset state when modal opens
  useEffect(() => {
    if (templateId) {
      setStatus("idle");
      setProgress(0);
      setProgressMessage("");
      setError(null);
      setCreatedDatasetId(null);
      setNumExamples(50);
      setVariation("medium");
      setTopics("");
    }
  }, [templateId]);

  const estimatedCredits = (numExamples * 0.002).toFixed(3);
  const estimatedTime = Math.ceil(numExamples / 10) * 15; // ~15 seconds per 10 examples

  const handleGenerate = async () => {
    if (!template) return;

    setStatus("generating");
    setProgress(0);
    setError(null);

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Please sign in to generate datasets");
      }

      // Create dataset record first
      const datasetName = `${template.name} - Generated`;
      const { data: dataset, error: datasetError } = await supabase
        .from("datasets")
        .insert({
          name: datasetName,
          description: `Auto-generated from template: ${template.name}`,
          source_type: "synthetic",
          status: "pending",
          user_id: session.user.id,
          source_config: {
            template_id: template.id,
            template_name: template.name,
            variation,
            topics: topics.split(",").map(t => t.trim()).filter(Boolean),
          },
        })
        .select()
        .single();

      if (datasetError) {
        throw new Error(`Failed to create dataset: ${datasetError.message}`);
      }

      setCreatedDatasetId(dataset.id);
      setProgress(10);
      setProgressMessage("Dataset created, generating examples...");

      // Simulate progress updates while generating
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 85) return prev;
          const increment = Math.random() * 5 + 2;
          return Math.min(prev + increment, 85);
        });
        const generated = Math.floor((progress / 100) * numExamples);
        setProgressMessage(`Generating examples... ${generated} of ${numExamples}`);
      }, 1500);

      // Call generate-synthetic Edge Function with template mode using retry helper
      const { data: result, error: generateError } = await invokeWithRetry('generate-synthetic', {
        dataset_id: dataset.id,
        template_mode: true,
        template_id: template.id,
        num_examples: numExamples,
        variation,
        topics: topics.split(",").map(t => t.trim()).filter(Boolean),
        language: template.language,
        language_code: template.language_code,
        domain: template.domain,
        system_prompt: template.sample_system_prompt,
        sample_conversations: template.sample_conversations,
      });

      clearInterval(progressInterval);

      if (generateError) {
        // Handle specific error codes
        if (generateError.message?.includes('Insufficient') || generateError.message?.includes('402')) {
          setError(`Insufficient credits. You need ${estimatedCredits} credits.`);
          setStatus("error");
          return;
        }
        throw new Error(getEdgeFunctionErrorMessage(generateError, 'generate-synthetic'));
      }

      setProgress(100);
      setProgressMessage(`Generated ${result.row_count} examples successfully!`);
      setStatus("success");

      toast({
        title: "Dataset Generated",
        description: `Created ${result.row_count} training examples from template`,
      });

    } catch (err) {
      console.error("Generation error:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
      setStatus("error");
    }
  };

  const handleRetry = () => {
    setStatus("idle");
    setError(null);
    setProgress(0);
  };

  const handleViewDataset = () => {
    if (createdDatasetId) {
      navigate(`/dashboard/datasets/${createdDatasetId}`);
      onClose();
    }
  };

  const handleStartFinetuning = () => {
    if (createdDatasetId) {
      navigate("/dashboard/finetuning", {
        state: {
          datasetId: createdDatasetId,
          baseModel: template?.recommended_model,
          templateId: template?.id,
        },
      });
      onClose();
    }
  };

  return (
    <Dialog open={!!templateId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generate Dataset from Template
          </DialogTitle>
          {template && (
            <DialogDescription className="flex items-center gap-2 pt-1">
              {(() => {
                const DomainIcon = getDomainIcon(template.domain);
                return (
                  <SwissIconTile size="xs" variant="muted">
                    <DomainIcon className="h-3 w-3" />
                  </SwissIconTile>
                );
              })()}
              <span>{template.name}</span>
              <Badge variant="outline" className="ml-1">{template.language}</Badge>
            </DialogDescription>
          )}
        </DialogHeader>

        {templateLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : status === "idle" ? (
          <div className="space-y-6 py-4">
            {/* Number of Examples */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Number of Examples</Label>
                <span className="text-sm font-medium">{numExamples}</span>
              </div>
              <Slider
                value={[numExamples]}
                onValueChange={([value]) => setNumExamples(value)}
                min={10}
                max={100}
                step={5}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Recommended: 50-100 examples for quality fine-tuning
              </p>
            </div>

            {/* Variation Level */}
            <div className="space-y-2">
              <Label>Variation Level</Label>
              <Select value={variation} onValueChange={(v) => setVariation(v as typeof variation)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">
                    <div className="flex flex-col items-start">
                      <span>Low</span>
                      <span className="text-xs text-muted-foreground">Closely follows template examples</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="medium">
                    <div className="flex flex-col items-start">
                      <span>Medium</span>
                      <span className="text-xs text-muted-foreground">Balanced variety and consistency</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="high">
                    <div className="flex flex-col items-start">
                      <span>High</span>
                      <span className="text-xs text-muted-foreground">More creative and diverse examples</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Topics */}
            <div className="space-y-2">
              <Label>Specific Topics (optional)</Label>
              <Input
                placeholder="e.g., shipping, returns, payment issues"
                value={topics}
                onChange={(e) => setTopics(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated list of topics to focus on
              </p>
            </div>

            {/* Cost estimate */}
            <div className="rounded-lg bg-muted/50 border p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Estimated cost</span>
                <span className="font-medium">{estimatedCredits} credits</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Estimated time</span>
                <span className="font-medium">~{estimatedTime} seconds</span>
              </div>
            </div>

            <Button onClick={handleGenerate} className="w-full gap-2">
              <Sparkles className="h-4 w-4" />
              Generate {numExamples} Examples
            </Button>
          </div>
        ) : status === "generating" ? (
          <div className="py-8 space-y-4">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-center text-muted-foreground">
                {progressMessage || "Preparing generation..."}
              </p>
            </div>
            <p className="text-xs text-center text-muted-foreground">
              This may take a few minutes. Please don't close this window.
            </p>
          </div>
        ) : status === "success" ? (
          <div className="py-8 space-y-6">
            <div className="flex flex-col items-center text-center">
              <div className="rounded-full bg-success/20 p-3 mb-3">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
              <h3 className="text-lg font-medium">Dataset Generated!</h3>
              <p className="text-sm text-muted-foreground">
                {progressMessage}
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={handleViewDataset}>
                View Dataset
              </Button>
              <Button className="flex-1 gap-2" onClick={handleStartFinetuning}>
                Start Fine-tuning
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : status === "error" ? (
          <div className="py-8 space-y-6">
            <div className="flex flex-col items-center text-center">
              <div className="rounded-full bg-destructive/20 p-3 mb-3">
                {error?.includes("credits") ? (
                  <AlertTriangle className="h-8 w-8 text-warning" />
                ) : (
                  <XCircle className="h-8 w-8 text-destructive" />
                )}
              </div>
              <h3 className="text-lg font-medium">
                {error?.includes("credits") ? "Insufficient Credits" : "Generation Failed"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {error}
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
              {error?.includes("credits") ? (
                <Button className="flex-1" onClick={() => navigate("/dashboard/billing")}>
                  Add Credits
                </Button>
              ) : (
                <Button className="flex-1" onClick={handleRetry}>
                  Try Again
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
