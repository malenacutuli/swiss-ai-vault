import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  Copy, 
  Check, 
  ChevronDown, 
  ExternalLink, 
  Sparkles, 
  Play,
  Clock,
  Cpu
} from "@/icons";
import { useFinetuningTemplate } from "@/hooks/useFinetuningTemplates";
import { useToast } from "@/hooks/use-toast";

interface TemplateDetailModalProps {
  templateId: string | null;
  onClose: () => void;
  onGenerateDataset?: (templateId: string) => void;
}

export const TemplateDetailModal = ({ templateId, onClose, onGenerateDataset }: TemplateDetailModalProps) => {
  const { data: template, isLoading } = useFinetuningTemplate(templateId);
  const [copied, setCopied] = useState(false);
  const [conversationsOpen, setConversationsOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleCopyPrompt = async () => {
    if (template?.sample_system_prompt) {
      await navigator.clipboard.writeText(template.sample_system_prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied!",
        description: "System prompt copied to clipboard",
      });
    }
  };

  const handleGenerateDataset = () => {
    if (template && onGenerateDataset) {
      onGenerateDataset(template.id);
    }
    onClose();
  };

  const handleStartFinetuning = () => {
    navigate("/dashboard/finetuning", { 
      state: { 
        templateId: template?.id,
        baseModel: template?.recommended_model,
        systemPrompt: template?.sample_system_prompt,
      } 
    });
    onClose();
  };

  const getDomainLabel = (domain: string) => {
    const labels: Record<string, string> = {
      customer_service: "Customer Service",
      finance: "Finance",
      legal: "Legal",
      healthcare: "Healthcare",
      insurance: "Insurance",
      hr: "Human Resources",
      retail: "Retail",
    };
    return labels[domain] || domain;
  };

  return (
    <Dialog open={!!templateId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : template ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{template.icon}</span>
                <div>
                  <DialogTitle className="text-xl">{template.name}</DialogTitle>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline">{template.language}</Badge>
                    <Badge variant="secondary">{getDomainLabel(template.domain)}</Badge>
                  </div>
                </div>
              </div>
              <DialogDescription className="pt-2">
                {template.description}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Meta info */}
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{template.estimated_time}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Cpu className="h-4 w-4" />
                  <span>{template.recommended_model}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5"
                    onClick={() => navigate("/dashboard/catalog")}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
                <Badge 
                  variant="outline" 
                  className="capitalize"
                >
                  {template.difficulty}
                </Badge>
              </div>

              {/* Use cases */}
              {template.use_cases && template.use_cases.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Use Cases</h4>
                  <div className="flex flex-wrap gap-2">
                    {template.use_cases.map((useCase, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {useCase}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* System prompt */}
              {template.sample_system_prompt && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium">Sample System Prompt</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyPrompt}
                      className="h-7 gap-1.5"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="rounded-lg bg-muted/50 border p-3 text-sm font-mono text-muted-foreground">
                    {template.sample_system_prompt}
                  </div>
                </div>
              )}

              {/* Sample conversations */}
              {template.sample_conversations && template.sample_conversations.length > 0 && (
                <Collapsible open={conversationsOpen} onOpenChange={setConversationsOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between h-auto py-2">
                      <span className="text-sm font-medium">
                        Sample Conversations ({template.sample_conversations.length})
                      </span>
                      <ChevronDown 
                        className={`h-4 w-4 transition-transform ${conversationsOpen ? "rotate-180" : ""}`} 
                      />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-2">
                    {template.sample_conversations.slice(0, 2).map((conv, i) => (
                      <div key={i} className="rounded-lg border bg-card p-3 space-y-2">
                        {conv.messages.map((msg, j) => (
                          <div key={j} className="text-sm">
                            <span className={`font-medium ${
                              msg.role === "user" ? "text-info" : 
                              msg.role === "assistant" ? "text-success" : 
                              "text-muted-foreground"
                            }`}>
                              {msg.role}:
                            </span>
                            <p className="text-muted-foreground mt-0.5 pl-2 border-l-2 border-border">
                              {msg.content.length > 200 
                                ? msg.content.substring(0, 200) + "..." 
                                : msg.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Hyperparameters */}
              {template.default_hyperparameters && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Default Hyperparameters</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(template.default_hyperparameters).map(([key, value]) => (
                      <div key={key} className="rounded-lg bg-muted/50 border p-2 text-center">
                        <div className="text-xs text-muted-foreground">{key}</div>
                        <div className="text-sm font-medium">{String(value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button 
                variant="outline" 
                className="flex-1 gap-2"
                onClick={handleGenerateDataset}
              >
                <Sparkles className="h-4 w-4" />
                Generate Sample Dataset
              </Button>
              <Button 
                className="flex-1 gap-2"
                onClick={handleStartFinetuning}
              >
                <Play className="h-4 w-4" />
                Start Fine-tuning
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Template not found
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
