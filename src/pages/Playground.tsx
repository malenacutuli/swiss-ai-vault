import { useState, useRef, useEffect } from "react";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
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
} from "lucide-react";
import { useModels } from "@/hooks/useSupabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  tokens?: { prompt: number; completion: number };
  latency?: number;
}

const providerModels = [
  { id: "gpt-4o-mini", name: "GPT-4o Mini", group: "openai", provider: "OpenAI" },
  { id: "gpt-4o", name: "GPT-4o", group: "openai", provider: "OpenAI" },
  { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", group: "anthropic", provider: "Anthropic" },
  { id: "claude-3-5-haiku", name: "Claude 3.5 Haiku", group: "anthropic", provider: "Anthropic" },
];

const baseModels = [
  { id: "llama3.2-3b", name: "Llama 3.2 3B", group: "base" },
  { id: "mistral-7b", name: "Mistral 7B", group: "base" },
  { id: "qwen2.5-3b", name: "Qwen 2.5 3B", group: "base" },
];

const systemPromptTemplates = [
  { id: "helpful", name: "Helpful Assistant", prompt: "You are a helpful, harmless, and honest AI assistant." },
  { id: "code", name: "Code Helper", prompt: "You are an expert programmer. Help users write clean, efficient code." },
  { id: "custom", name: "Custom...", prompt: "" },
];

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { models: userModels } = useModels();
  const { session } = useAuth();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

    const allMessages = [
      ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
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
        
        throw new Error(errorData.error?.message || `Request failed with status ${response.status}`);
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
      toast.error(errorMessage);
      
      // Remove the user message if we failed
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
    const providerModel = providerModels.find(m => m.id === selectedModel);
    if (providerModel) return providerModel.name;
    
    const baseModel = baseModels.find(m => m.id === selectedModel);
    if (baseModel) return baseModel.name;
    
    const userModel = userModels?.find(m => m.model_id === selectedModel);
    if (userModel) return userModel.name;
    
    return selectedModel;
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
                  <SelectContent className="bg-popover border-border z-50">
                    {/* User's Fine-tuned Models */}
                    {userModels && userModels.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Your Models</SelectLabel>
                        {userModels.map((model) => (
                          <SelectItem key={model.model_id} value={model.model_id}>
                            <div className="flex items-center gap-2">
                              <Sparkles className="h-3 w-3 text-primary" />
                              {model.name}
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
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    
                    {/* Anthropic Models */}
                    <SelectGroup>
                      <SelectLabel>Anthropic</SelectLabel>
                      {providerModels.filter(m => m.group === "anthropic").map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    
                    {/* Base Open Source Models */}
                    <SelectGroup>
                      <SelectLabel>Open Source</SelectLabel>
                      {baseModels.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
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
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-medium text-foreground">
                {getModelDisplayName()}
              </span>
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
                  Select a model and start chatting. Your conversation will appear here.
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
                <div className="bg-secondary rounded-lg px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default Playground;
