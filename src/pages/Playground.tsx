import { useState, useRef, useEffect } from "react";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Send,
  Trash2,
  Copy,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Bot,
  User,
  Loader2,
  AlertCircle,
  Zap,
  Clock,
  Info,
  Paperclip,
  FileText,
  X,
  Upload,
  Lock,
  Shield,
} from "lucide-react";
import { useModels } from "@/hooks/useSupabase";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useZeroRetentionMode } from "@/hooks/useZeroRetentionMode";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  tokens?: { prompt: number; completion: number };
  latency?: number;
}

interface ModelInfo {
  id: string;
  name: string;
  group: string;
  provider?: string;
  contextLength?: number;
  parameters?: string;
  coldStart?: boolean;
}

interface UploadedDocument {
  filename: string;
  chunks: number;
  uploadedAt: Date;
}

const providerModels: ModelInfo[] = [
  { id: "gpt-4o-mini", name: "GPT-4o Mini", group: "openai", provider: "OpenAI", contextLength: 128000 },
  { id: "gpt-4o", name: "GPT-4o", group: "openai", provider: "OpenAI", contextLength: 128000 },
  { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", group: "anthropic", provider: "Anthropic", contextLength: 200000 },
  { id: "claude-3-5-haiku", name: "Claude 3.5 Haiku", group: "anthropic", provider: "Anthropic", contextLength: 200000 },
];

const openSourceModels: ModelInfo[] = [
  { id: "qwen2.5-0.5b", name: "Qwen 2.5 0.5B", group: "opensource", parameters: "0.5B", contextLength: 32768, coldStart: true },
  { id: "qwen2.5-1.5b", name: "Qwen 2.5 1.5B", group: "opensource", parameters: "1.5B", contextLength: 32768, coldStart: true },
  { id: "qwen2.5-3b", name: "Qwen 2.5 3B", group: "opensource", parameters: "3B", contextLength: 32768, coldStart: true },
  { id: "qwen2.5-7b", name: "Qwen 2.5 7B", group: "opensource", parameters: "7B", contextLength: 32768, coldStart: true },
  { id: "mistral-7b", name: "Mistral 7B", group: "opensource", parameters: "7B", contextLength: 32768, coldStart: true },
  { id: "gemma2-2b", name: "Gemma 2 2B", group: "opensource", parameters: "2B", contextLength: 8192, coldStart: true },
  { id: "llama3.2-1b", name: "Llama 3.2 1B", group: "opensource", parameters: "1B", contextLength: 131072, coldStart: true },
  { id: "llama3.2-3b", name: "Llama 3.2 3B", group: "opensource", parameters: "3B", contextLength: 131072, coldStart: true },
];

const systemPromptTemplates = [
  { id: "helpful", name: "Helpful Assistant", prompt: "You are a helpful, harmless, and honest AI assistant." },
  { id: "code", name: "Code Helper", prompt: "You are an expert programmer. Help users write clean, efficient code." },
  { id: "custom", name: "Custom...", prompt: "" },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_FILE_TYPES = [".txt", ".md", ".pdf", ".docx"];

const Playground = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [configPanelOpen, setConfigPanelOpen] = useState(true);
  const [selectedModel, setSelectedModel] = useState("gpt-4o-mini");
  const [systemPrompt, setSystemPrompt] = useState(systemPromptTemplates[0].prompt);
  const [temperature, setTemperature] = useState([0.7]);
  const [maxTokens, setMaxTokens] = useState([1024]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingTime, setLoadingTime] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // RAG state
  const [conversationId] = useState(() => crypto.randomUUID());
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [documentsPopoverOpen, setDocumentsPopoverOpen] = useState(false);
  
  const { models: userModels } = useModels();
  const { session } = useAuth();
  const { data: zeroRetentionMode } = useZeroRetentionMode();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Track loading time for cold start message
  useEffect(() => {
    if (isLoading) {
      setLoadingTime(0);
      setLoadingMessage("");
      loadingTimerRef.current = setInterval(() => {
        setLoadingTime(prev => {
          const newTime = prev + 1;
          if (newTime >= 5 && isColdStartModel(selectedModel)) {
            setLoadingMessage("Model is warming up... This may take 30-60 seconds on first request.");
          }
          return newTime;
        });
      }, 1000);
    } else {
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
      setLoadingTime(0);
      setLoadingMessage("");
    }
    return () => {
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current);
      }
    };
  }, [isLoading, selectedModel]);

  // Check if model might have cold start
  const isColdStartModel = (modelId: string) => {
    return modelId.startsWith("sv-") || 
           openSourceModels.some(m => m.id === modelId);
  };

  // Get model info for display
  const getModelInfo = (modelId: string): ModelInfo | null => {
    const provider = providerModels.find(m => m.id === modelId);
    if (provider) return provider;
    
    const openSource = openSourceModels.find(m => m.id === modelId);
    if (openSource) return openSource;
    
    const userModel = userModels?.find(m => m.model_id === modelId);
    if (userModel) {
      return {
        id: userModel.model_id,
        name: userModel.name,
        group: "finetuned",
        parameters: userModel.parameter_count ? `${(userModel.parameter_count / 1e9).toFixed(1)}B` : undefined,
        contextLength: userModel.context_length || undefined,
        coldStart: true,
      };
    }
    
    return null;
  };

  // Handle file upload for RAG
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const extension = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_FILE_TYPES.includes(extension)) {
      toast.error(`Unsupported file type. Accepted: ${ACCEPTED_FILE_TYPES.join(", ")}`);
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File too large. Maximum size is 10MB.");
      return;
    }

    if (!session?.access_token) {
      toast.error("Please sign in to upload documents");
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("conversation_id", conversationId);

      setUploadProgress(30);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/embed-document`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      setUploadProgress(80);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Upload failed: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setUploadedDocuments(prev => [
          ...prev,
          {
            filename: result.filename,
            chunks: result.chunks_created,
            uploadedAt: new Date(),
          },
        ]);
        toast.success(`Document added to context (${result.chunks_created} chunks)`);
      } else {
        throw new Error(result.error || "Upload failed");
      }

      setUploadProgress(100);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload document");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Search for similar chunks
  const searchSimilarChunks = async (query: string): Promise<string[]> => {
    if (uploadedDocuments.length === 0 || !session?.access_token) {
      return [];
    }

    try {
      // Generate embedding for the query via Edge Function
      const embeddingResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: "embed",
            text: query,
          }),
        }
      );

      if (!embeddingResponse.ok) {
        console.error("Failed to generate embedding for query");
        return [];
      }

      const embeddingData = await embeddingResponse.json();
      const embedding = embeddingData.embedding;

      if (!embedding) {
        console.error("No embedding returned from API");
        return [];
      }

      // Search for similar chunks using the embedding
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return [];

      const { data: chunks, error } = await supabase.rpc("search_document_chunks", {
        p_user_id: user.user.id,
        p_conversation_id: conversationId,
        p_embedding: JSON.stringify(embedding),
        p_match_count: 5,
        p_match_threshold: 0.7,
      });

      if (error) {
        console.error("Search error:", error);
        return [];
      }

      return (chunks || []).map((c: { content: string }) => c.content);
    } catch (error) {
      console.error("Error searching chunks:", error);
      return [];
    }
  };

  // Remove a specific document
  const removeDocument = async (filename: string) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { error } = await supabase
        .from("document_chunks")
        .delete()
        .eq("user_id", user.user.id)
        .eq("filename", filename)
        .eq("conversation_id", conversationId);

      if (error) throw error;

      setUploadedDocuments(prev => prev.filter(d => d.filename !== filename));
      toast.success(`Removed ${filename} from context`);
    } catch (error) {
      console.error("Error removing document:", error);
      toast.error("Failed to remove document");
    }
  };

  // Clear all documents
  const clearAllDocuments = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { error } = await supabase
        .from("document_chunks")
        .delete()
        .eq("user_id", user.user.id)
        .eq("conversation_id", conversationId);

      if (error) throw error;

      setUploadedDocuments([]);
      setDocumentsPopoverOpen(false);
      toast.success("Cleared all document context");
    } catch (error) {
      console.error("Error clearing documents:", error);
      toast.error("Failed to clear documents");
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    if (!session?.access_token) {
      toast.error("Please sign in to use the playground");
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    // Build system prompt with RAG context if documents are uploaded
    let enhancedSystemPrompt = systemPrompt;
    
    if (uploadedDocuments.length > 0) {
      try {
        const relevantChunks = await searchSimilarChunks(input.trim());
        if (relevantChunks.length > 0) {
          const contextSection = relevantChunks
            .map((chunk, i) => `[${i + 1}] ${chunk}`)
            .join("\n\n");
          
          enhancedSystemPrompt = `${systemPrompt}\n\nContext from uploaded documents:\n\n${contextSection}\n\n---\n\nUse the above context to help answer the user's question when relevant.`;
        }
      } catch (error) {
        console.error("Error fetching RAG context:", error);
        // Continue without RAG context
      }
    }

    const allMessages = [
      ...(enhancedSystemPrompt ? [{ role: "system" as const, content: enhancedSystemPrompt }] : []),
      ...messages.map(m => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: input.trim() },
    ];

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    const startTime = Date.now();

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: allMessages,
            temperature: temperature[0],
            max_tokens: maxTokens[0],
            stream: false,
          }),
        }
      );

      const latency = Date.now() - startTime;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 401) {
          toast.error("Authentication failed. Please sign in again.");
          return;
        }
        if (response.status === 429) {
          toast.error("Rate limit exceeded. Please wait a moment and try again.");
          return;
        }
        if (response.status === 504) {
          toast.error("Request timed out. The model may be starting up. Please try again in a minute.", {
            duration: 8000,
            action: {
              label: "Use GPT-4o Mini",
              onClick: () => setSelectedModel("gpt-4o-mini"),
            },
          });
          setMessages((prev) => prev.filter(m => m.id !== userMessage.id));
          return;
        }
        
        // Handle vLLM-specific errors
        const errorMessage = errorData.error?.message || `Request failed with status ${response.status}`;
        if (errorMessage.includes("cold start") || errorMessage.includes("warming up")) {
          toast.error("Model is warming up. Please wait 30-60 seconds and try again.", {
            duration: 8000,
            action: {
              label: "Use GPT-4o Mini",
              onClick: () => setSelectedModel("gpt-4o-mini"),
            },
          });
          setMessages((prev) => prev.filter(m => m.id !== userMessage.id));
          return;
        }
        if (errorMessage.includes("not found") || errorMessage.includes("not deployed")) {
          toast.error(`Model not available: ${errorMessage}. Try using a different model.`, {
            duration: 8000,
          });
          setMessages((prev) => prev.filter(m => m.id !== userMessage.id));
          return;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message || "Unknown error");
      }

      const assistantContent = data.choices?.[0]?.message?.content || "No response received.";
      const usage = data.usage || {};

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: assistantContent,
        tokens: {
          prompt: usage.prompt_tokens || 0,
          completion: usage.completion_tokens || 0,
        },
        latency,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to get response";
      
      // Suggest fallback for vLLM errors
      if (errorMessage.includes("vLLM") || errorMessage.includes("Inference")) {
        toast.error(errorMessage, {
          duration: 8000,
          action: {
            label: "Use Claude instead",
            onClick: () => setSelectedModel("claude-3-5-haiku"),
          },
        });
      } else {
        toast.error(errorMessage);
      }
      
      setMessages((prev) => prev.filter(m => m.id !== userMessage.id));
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Copied to clipboard");
  };

  // Get display name for selected model
  const getModelDisplayName = () => {
    const info = getModelInfo(selectedModel);
    return info?.name || selectedModel;
  };

  // Get base model for fine-tuned models
  const getFinetunedBaseModel = (modelId: string) => {
    const userModel = userModels?.find(m => m.model_id === modelId);
    return userModel?.base_model || null;
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div
        className={cn(
          "transition-all duration-300 flex",
          sidebarCollapsed ? "ml-16" : "ml-[280px]"
        )}
      >
        {/* Config Panel */}
        <aside
          className={cn(
            "fixed top-0 bottom-0 border-r border-border bg-card transition-all duration-300 overflow-y-auto z-20",
            sidebarCollapsed ? "left-16" : "left-[280px]",
            configPanelOpen ? "w-80" : "w-0"
          )}
        >
          {configPanelOpen && (
            <div className="p-4 space-y-6 pt-20">
              {/* Model Selection */}
              <div className="space-y-2">
                <Label className="text-foreground">Model</Label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border z-50 max-h-[400px]">
                    {/* User's Fine-tuned Models */}
                    {userModels && userModels.length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="flex items-center gap-2">
                          <Sparkles className="h-3 w-3" />
                          Your Fine-tuned Models
                        </SelectLabel>
                        {userModels.map((model) => (
                          <SelectItem key={model.model_id} value={model.model_id}>
                            <div className="flex items-center gap-2 w-full">
                              <Sparkles className="h-3 w-3 text-primary flex-shrink-0" />
                              <span className="truncate">{model.name}</span>
                              {model.is_deployed ? (
                                <Badge variant="outline" className="ml-auto text-[10px] px-1 py-0 bg-success/10 text-success border-success/30">
                                  deployed
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="ml-auto text-[10px] px-1 py-0">
                                  ready
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    
                    {/* OpenAI Models */}
                    <SelectGroup>
                      <SelectLabel>OpenAI</SelectLabel>
                      {providerModels.filter(m => m.group === "openai").map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          <div className="flex items-center gap-2">
                            <Zap className="h-3 w-3 text-success flex-shrink-0" />
                            {model.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    
                    {/* Anthropic Models */}
                    <SelectGroup>
                      <SelectLabel>Anthropic</SelectLabel>
                      {providerModels.filter(m => m.group === "anthropic").map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          <div className="flex items-center gap-2">
                            <Zap className="h-3 w-3 text-success flex-shrink-0" />
                            {model.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    
                    {/* Open Source Models */}
                    <SelectGroup>
                      <SelectLabel className="flex items-center gap-2">
                        Open Source
                        <Badge variant="outline" className="text-[10px] px-1 py-0 text-warning border-warning/30">
                          cold start
                        </Badge>
                      </SelectLabel>
                      {openSourceModels.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          <div className="flex items-center gap-2 w-full">
                            <Clock className="h-3 w-3 text-warning flex-shrink-0" />
                            <span>{model.name}</span>
                            <span className="ml-auto text-[10px] text-muted-foreground">{model.parameters}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                
                {/* Model Info */}
                {isColdStartModel(selectedModel) && (
                  <div className="flex items-start gap-2 p-2 rounded-md bg-warning/10 border border-warning/20">
                    <AlertCircle className="h-3.5 w-3.5 text-warning flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-warning">
                      First request may take 30-60s to warm up. Subsequent requests are fast.
                    </p>
                  </div>
                )}
                
                {/* Fine-tuned model info */}
                {selectedModel.startsWith("sv-") && (
                  <div className="space-y-1 text-xs text-muted-foreground p-2 rounded-md bg-secondary/50">
                    {getFinetunedBaseModel(selectedModel) && (
                      <div className="flex justify-between">
                        <span>Base Model:</span>
                        <span className="font-medium text-foreground">{getFinetunedBaseModel(selectedModel)}</span>
                      </div>
                    )}
                    {getModelInfo(selectedModel)?.parameters && (
                      <div className="flex justify-between">
                        <span>Parameters:</span>
                        <span className="font-medium text-foreground">{getModelInfo(selectedModel)?.parameters}</span>
                      </div>
                    )}
                    {getModelInfo(selectedModel)?.contextLength && (
                      <div className="flex justify-between">
                        <span>Context:</span>
                        <span className="font-medium text-foreground">{(getModelInfo(selectedModel)?.contextLength || 0).toLocaleString()} tokens</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Parameters */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-foreground">Parameters</h3>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-sm text-muted-foreground">Temperature</Label>
                    <span className="text-sm text-foreground">{temperature[0]}</span>
                  </div>
                  <Slider
                    value={temperature}
                    onValueChange={setTemperature}
                    max={2}
                    min={0}
                    step={0.1}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Lower = more focused, Higher = more creative
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-sm text-muted-foreground">Max Tokens</Label>
                    <span className="text-sm text-foreground">{maxTokens[0]}</span>
                  </div>
                  <Slider
                    value={maxTokens}
                    onValueChange={setMaxTokens}
                    max={4096}
                    min={1}
                    step={64}
                    className="w-full"
                  />
                </div>
              </div>

              {/* System Prompt */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-foreground">System Prompt</Label>
                  <Select
                    onValueChange={(value) => {
                      const template = systemPromptTemplates.find((t) => t.id === value);
                      if (template && template.prompt) {
                        setSystemPrompt(template.prompt);
                      }
                    }}
                  >
                    <SelectTrigger className="w-32 h-7 text-xs bg-secondary border-border">
                      <SelectValue placeholder="Template" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border z-50">
                      {systemPromptTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="bg-secondary border-border min-h-[120px] text-sm"
                  placeholder="Enter system prompt..."
                />
              </div>
            </div>
          )}
        </aside>

        {/* Toggle Config Panel Button */}
        <button
          onClick={() => setConfigPanelOpen(!configPanelOpen)}
          className={cn(
            "fixed top-1/2 -translate-y-1/2 z-30 p-1 bg-card border border-border rounded-r-lg transition-all",
            sidebarCollapsed ? "left-16" : "left-[280px]",
            configPanelOpen && (sidebarCollapsed ? "left-[336px]" : "left-[600px]")
          )}
        >
          {configPanelOpen ? (
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {/* Main Chat Area */}
        <div
          className={cn(
            "flex-1 flex flex-col transition-all duration-300",
            configPanelOpen ? "ml-80" : "ml-0"
          )}
        >
          <DashboardHeader sidebarCollapsed={sidebarCollapsed} />

          {/* Chat Header */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-medium text-foreground">
                  {getModelDisplayName()}
                </span>
              </div>
              
              {/* Zero-Retention Mode Indicator */}
              {zeroRetentionMode && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-green-500/10 px-3 py-1 rounded-full">
                  <Shield className="h-3 w-3 text-green-500" />
                  <span>Zero-Retention Mode Active</span>
                </div>
              )}
              
              {/* Document Context Indicator */}
              {uploadedDocuments.length > 0 && (
                <Popover open={documentsPopoverOpen} onOpenChange={setDocumentsPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1.5 bg-primary/10 border-primary/20 hover:bg-primary/20"
                    >
                      <FileText className="h-3 w-3" />
                      {uploadedDocuments.length} document{uploadedDocuments.length > 1 ? "s" : ""}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-3" align="start">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium">Document Context</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearAllDocuments}
                          className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                        >
                          Clear all
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {uploadedDocuments.map((doc) => (
                          <div
                            key={doc.filename}
                            className="flex items-center justify-between p-2 rounded-md bg-secondary/50"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-medium truncate">{doc.filename}</p>
                                <p className="text-[10px] text-muted-foreground">{doc.chunks} chunks</p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeDocument(doc.filename)}
                              className="h-6 w-6 flex-shrink-0"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              
              {/* Zero-Retention Mode Indicator */}
              {zeroRetentionMode && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                        <Lock className="h-3 w-3" />
                        <span className="text-xs font-medium">Private</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>Zero-retention mode active - this conversation is not logged</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
              className="text-muted-foreground hover:text-foreground"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Bot className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Start a conversation
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm mb-6">
                  Select a model and start chatting. Upload documents for context-aware responses.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {[
                    "Explain quantum computing simply",
                    "Write a Python function to...",
                    "Help me draft an email about...",
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => setInput(prompt)}
                      className="px-3 py-1.5 text-sm rounded-full border border-border hover:bg-secondary transition-colors text-muted-foreground"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === "assistant" && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[70%] rounded-lg px-4 py-3 group",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-foreground"
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    {message.role === "assistant" && (
                      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
                        {message.tokens && (
                          <span>
                            {message.tokens.prompt + message.tokens.completion} tokens
                          </span>
                        )}
                        {message.latency && <span>{message.latency}ms</span>}
                        <button
                          onClick={() => copyMessage(message.content)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  {message.role === "user" && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-info/20 flex items-center justify-center">
                      <User className="h-4 w-4 text-info" />
                    </div>
                  )}
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                </div>
                <div className="bg-secondary rounded-lg px-4 py-3 space-y-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  {loadingMessage && (
                    <p className="text-xs text-warning flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      {loadingMessage}
                    </p>
                  )}
                  {loadingTime > 0 && (
                    <p className="text-[10px] text-muted-foreground">{loadingTime}s</p>
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div className="px-4 py-2 border-t border-border bg-secondary/50">
              <div className="flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">Processing document...</p>
                  <Progress value={uploadProgress} className="h-1" />
                </div>
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="border-t border-border">
            {/* Document indicator - show above input */}
            {uploadedDocuments.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-muted/50">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {uploadedDocuments.length} document{uploadedDocuments.length > 1 ? 's' : ''} attached
                </span>
                <div className="flex gap-1 flex-wrap flex-1">
                  {uploadedDocuments.map((doc, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {doc.filename}
                    </Badge>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllDocuments}
                  title="Clear all documents"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}

            <div className="p-4">
              <div className="flex gap-2">
                {/* File Upload Button */}
                <input
                  ref={fileInputRef}
                  type="file"
                  id="doc-upload"
                  accept=".pdf,.docx,.pptx,.txt,.md"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isUploading}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || isLoading}
                  className="flex-shrink-0"
                  title="Upload document for context"
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Paperclip className="h-4 w-4" />
                  )}
                </Button>
                
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      handleSend();
                    }
                  }}
                  placeholder="Type a message... (Cmd+Enter to send)"
                  className="bg-secondary border-border min-h-[48px] max-h-[120px] resize-none"
                  rows={1}
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="bg-primary hover:bg-primary/90 px-4"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                Upload .txt, .md, .pdf, .pptx, or .docx files (max 10MB) to add context for your questions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Playground;
