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
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Bot,
  User,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  tokens?: { prompt: number; completion: number };
  latency?: number;
}

const baseModels = [
  { id: "llama3.2-3b", name: "Llama 3.2 3B", group: "base" },
  { id: "mistral-7b", name: "Mistral 7B", group: "base" },
  { id: "qwen2.5-7b", name: "Qwen 2.5 7B", group: "base" },
];

const fineTunedModels = [
  { id: "sv-customer-support-v2", name: "Customer Support v2", group: "finetuned" },
  { id: "sv-sales-assistant-v1", name: "Sales Assistant v1", group: "finetuned" },
  { id: "sv-code-reviewer", name: "Code Reviewer", group: "finetuned" },
];

const systemPromptTemplates = [
  { id: "helpful", name: "Helpful Assistant", prompt: "You are a helpful, harmless, and honest AI assistant." },
  { id: "code", name: "Code Helper", prompt: "You are an expert programmer. Help users write clean, efficient code." },
  { id: "custom", name: "Custom...", prompt: "" },
];

const Playground = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [configPanelOpen, setConfigPanelOpen] = useState(true);
  const [selectedModel, setSelectedModel] = useState("sv-customer-support-v2");
  const [systemPrompt, setSystemPrompt] = useState(systemPromptTemplates[0].prompt);
  const [temperature, setTemperature] = useState([0.7]);
  const [maxTokens, setMaxTokens] = useState([1024]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Simulate API response
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "This is a simulated response from the AI model. In production, this would connect to your SwissVault API endpoint and stream the response in real-time.\n\n```python\ndef hello_world():\n    print(\"Hello from SwissVault!\")\n```\n\nThe model is configured with temperature " + temperature[0] + " and max tokens " + maxTokens[0] + ".",
      tokens: { prompt: 42, completion: 78 },
      latency: 1234,
    };

    setMessages((prev) => [...prev, assistantMessage]);
    setIsLoading(false);
  };

  const clearChat = () => {
    setMessages([]);
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
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
            "fixed top-0 bottom-0 border-r border-border bg-card transition-all duration-300 overflow-y-auto",
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
                  <SelectContent className="bg-popover">
                    <SelectGroup>
                      <SelectLabel>Fine-tuned Models</SelectLabel>
                      {fineTunedModels.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-3 w-3 text-primary" />
                            {model.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>Base Models</SelectLabel>
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
                    step={1}
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
                    <SelectContent className="bg-popover">
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
            "fixed top-1/2 -translate-y-1/2 z-10 p-1 bg-card border border-border rounded-r-lg transition-all",
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
                {fineTunedModels.find((m) => m.id === selectedModel)?.name ||
                  baseModels.find((m) => m.id === selectedModel)?.name}
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
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
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
                  <Bot className="h-4 w-4 text-primary animate-pulse" />
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
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="bg-primary hover:bg-primary/90 px-4"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Playground;
