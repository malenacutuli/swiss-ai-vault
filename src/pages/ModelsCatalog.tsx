import { useState, useMemo } from "react";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useModels } from "@/hooks/useSupabase";
import {
  Search,
  SlidersHorizontal,
  ArrowUpRight,
  RotateCcw,
  Cpu,
  Sparkles,
  FileJson,
  X,
} from "lucide-react";

// Provider brand colors
const PROVIDER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  OpenAI: { bg: "bg-emerald-500/10", text: "text-emerald-500", border: "border-emerald-500/30" },
  Anthropic: { bg: "bg-orange-500/10", text: "text-orange-500", border: "border-orange-500/30" },
  Google: { bg: "bg-blue-500/10", text: "text-blue-500", border: "border-blue-500/30" },
  Meta: { bg: "bg-indigo-500/10", text: "text-indigo-500", border: "border-indigo-500/30" },
  Mistral: { bg: "bg-purple-500/10", text: "text-purple-500", border: "border-purple-500/30" },
  DeepSeek: { bg: "bg-cyan-500/10", text: "text-cyan-500", border: "border-cyan-500/30" },
  Qwen: { bg: "bg-pink-500/10", text: "text-pink-500", border: "border-pink-500/30" },
  IBM: { bg: "bg-blue-600/10", text: "text-blue-400", border: "border-blue-400/30" },
  Cohere: { bg: "bg-red-500/10", text: "text-red-500", border: "border-red-500/30" },
};

// Base models data (static - these don't change often)
const BASE_MODELS = [
  // OpenAI Models
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", params: "200B", context: 128000, inputPrice: 2.5, outputPrice: 10, finetunable: true, json: true, description: "Most capable GPT-4 model with vision" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI", params: "8B", context: 128000, inputPrice: 0.15, outputPrice: 0.6, finetunable: true, json: true, description: "Smaller, faster, and cheaper GPT-4" },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo", provider: "OpenAI", params: "200B", context: 128000, inputPrice: 10, outputPrice: 30, finetunable: false, json: true, description: "High intelligence model with vision" },
  { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", provider: "OpenAI", params: "20B", context: 16385, inputPrice: 0.5, outputPrice: 1.5, finetunable: true, json: true, description: "Fast and efficient for simple tasks" },
  
  // Anthropic Models
  { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", provider: "Anthropic", params: "70B", context: 200000, inputPrice: 3, outputPrice: 15, finetunable: false, json: true, description: "Most intelligent Claude model" },
  { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", provider: "Anthropic", params: "20B", context: 200000, inputPrice: 0.25, outputPrice: 1.25, finetunable: false, json: true, description: "Fast and efficient Claude model" },
  { id: "claude-3-opus", name: "Claude 3 Opus", provider: "Anthropic", params: "137B", context: 200000, inputPrice: 15, outputPrice: 75, finetunable: false, json: true, description: "Most powerful Claude model" },
  
  // Google Models
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", provider: "Google", params: "30B", context: 1048576, inputPrice: 0.1, outputPrice: 0.4, finetunable: false, json: true, description: "Latest multimodal Gemini model" },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", provider: "Google", params: "175B", context: 2097152, inputPrice: 1.25, outputPrice: 5, finetunable: true, json: true, description: "Advanced reasoning with 2M context" },
  { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", provider: "Google", params: "30B", context: 1048576, inputPrice: 0.075, outputPrice: 0.3, finetunable: true, json: true, description: "Fast multimodal model" },
  
  // Meta Llama Models
  { id: "llama-3.2-90b", name: "Llama 3.2 90B", provider: "Meta", params: "90B", context: 131072, inputPrice: 0.9, outputPrice: 0.9, finetunable: true, json: true, description: "Largest vision-capable Llama" },
  { id: "llama-3.2-11b", name: "Llama 3.2 11B", provider: "Meta", params: "11B", context: 131072, inputPrice: 0.055, outputPrice: 0.055, finetunable: true, json: true, description: "Multimodal Llama with vision" },
  { id: "llama-3.2-3b", name: "Llama 3.2 3B", provider: "Meta", params: "3B", context: 131072, inputPrice: 0.015, outputPrice: 0.015, finetunable: true, json: true, description: "Lightweight edge model" },
  { id: "llama-3.2-1b", name: "Llama 3.2 1B", provider: "Meta", params: "1B", context: 131072, inputPrice: 0.01, outputPrice: 0.01, finetunable: true, json: true, description: "Ultra-lightweight edge model" },
  { id: "llama-3.1-405b", name: "Llama 3.1 405B", provider: "Meta", params: "405B", context: 131072, inputPrice: 3, outputPrice: 3, finetunable: false, json: true, description: "Frontier-class open model" },
  { id: "llama-3.1-70b", name: "Llama 3.1 70B", provider: "Meta", params: "70B", context: 131072, inputPrice: 0.35, outputPrice: 0.4, finetunable: true, json: true, description: "Best open-source performance" },
  { id: "llama-3.1-8b", name: "Llama 3.1 8B", provider: "Meta", params: "8B", context: 131072, inputPrice: 0.025, outputPrice: 0.025, finetunable: true, json: true, description: "Efficient and capable" },
  
  // Mistral Models
  { id: "mistral-large", name: "Mistral Large", provider: "Mistral", params: "123B", context: 131072, inputPrice: 2, outputPrice: 6, finetunable: false, json: true, description: "Flagship Mistral model" },
  { id: "mistral-medium", name: "Mistral Medium", provider: "Mistral", params: "70B", context: 32768, inputPrice: 2.7, outputPrice: 8.1, finetunable: false, json: true, description: "Balanced performance" },
  { id: "mistral-small", name: "Mistral Small", provider: "Mistral", params: "22B", context: 32768, inputPrice: 0.2, outputPrice: 0.6, finetunable: true, json: true, description: "Cost-effective Mistral" },
  { id: "mistral-7b", name: "Mistral 7B", provider: "Mistral", params: "7B", context: 32768, inputPrice: 0.06, outputPrice: 0.06, finetunable: true, json: true, description: "Efficient open model" },
  { id: "mixtral-8x22b", name: "Mixtral 8x22B", provider: "Mistral", params: "141B", context: 65536, inputPrice: 0.65, outputPrice: 0.65, finetunable: true, json: true, description: "MoE architecture" },
  { id: "mixtral-8x7b", name: "Mixtral 8x7B", provider: "Mistral", params: "47B", context: 32768, inputPrice: 0.24, outputPrice: 0.24, finetunable: true, json: true, description: "Efficient MoE model" },
  
  // DeepSeek Models
  { id: "deepseek-v3", name: "DeepSeek V3", provider: "DeepSeek", params: "671B", context: 65536, inputPrice: 0.27, outputPrice: 1.1, finetunable: false, json: true, description: "Latest DeepSeek model" },
  { id: "deepseek-r1", name: "DeepSeek R1", provider: "DeepSeek", params: "671B", context: 65536, inputPrice: 0.55, outputPrice: 2.19, finetunable: false, json: true, description: "Reasoning-focused model" },
  { id: "deepseek-coder", name: "DeepSeek Coder", provider: "DeepSeek", params: "33B", context: 16384, inputPrice: 0.14, outputPrice: 0.28, finetunable: true, json: true, description: "Coding specialist" },
  
  // Qwen Models
  { id: "qwen-2.5-72b", name: "Qwen 2.5 72B", provider: "Qwen", params: "72B", context: 131072, inputPrice: 0.35, outputPrice: 0.4, finetunable: true, json: true, description: "Large multilingual model" },
  { id: "qwen-2.5-32b", name: "Qwen 2.5 32B", provider: "Qwen", params: "32B", context: 131072, inputPrice: 0.15, outputPrice: 0.2, finetunable: true, json: true, description: "Balanced Qwen model" },
  { id: "qwen-2.5-14b", name: "Qwen 2.5 14B", provider: "Qwen", params: "14B", context: 131072, inputPrice: 0.07, outputPrice: 0.1, finetunable: true, json: true, description: "Efficient Qwen model" },
  { id: "qwen-2.5-7b", name: "Qwen 2.5 7B", provider: "Qwen", params: "7B", context: 131072, inputPrice: 0.035, outputPrice: 0.05, finetunable: true, json: true, description: "Lightweight Qwen" },
  { id: "qwen-2.5-coder-32b", name: "Qwen 2.5 Coder 32B", provider: "Qwen", params: "32B", context: 131072, inputPrice: 0.15, outputPrice: 0.2, finetunable: true, json: true, description: "Code-specialized Qwen" },
  
  // IBM Granite Models
  { id: "granite-3-8b", name: "Granite 3.0 8B", provider: "IBM", params: "8B", context: 128000, inputPrice: 0.05, outputPrice: 0.1, finetunable: true, json: true, description: "Enterprise-ready model" },
  { id: "granite-3-2b", name: "Granite 3.0 2B", provider: "IBM", params: "2B", context: 128000, inputPrice: 0.02, outputPrice: 0.04, finetunable: true, json: true, description: "Lightweight enterprise model" },
  
  // Cohere Models
  { id: "command-r-plus", name: "Command R+", provider: "Cohere", params: "104B", context: 128000, inputPrice: 2.5, outputPrice: 10, finetunable: false, json: true, description: "Enterprise RAG model" },
  { id: "command-r", name: "Command R", provider: "Cohere", params: "35B", context: 128000, inputPrice: 0.15, outputPrice: 0.6, finetunable: true, json: true, description: "Efficient RAG model" },
];

type SortOption = "name" | "context" | "params" | "inputPrice" | "outputPrice";

const ModelsCatalog = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState("base");
  const [search, setSearch] = useState("");
  const [finetuneOnly, setFinetuneOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [selectedProvider, setSelectedProvider] = useState<string>("all");
  const [selectedModel, setSelectedModel] = useState<typeof BASE_MODELS[0] | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const { models: fineTunedModels, loading: ftLoading } = useModels();

  const providers = useMemo(() => {
    const providerSet = new Set(BASE_MODELS.map(m => m.provider));
    return Array.from(providerSet).sort();
  }, []);

  const filteredBaseModels = useMemo(() => {
    let filtered = BASE_MODELS;

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(m => 
        m.name.toLowerCase().includes(searchLower) || 
        m.provider.toLowerCase().includes(searchLower) ||
        m.id.toLowerCase().includes(searchLower)
      );
    }

    if (finetuneOnly) {
      filtered = filtered.filter(m => m.finetunable);
    }

    if (selectedProvider !== "all") {
      filtered = filtered.filter(m => m.provider === selectedProvider);
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "context":
          return b.context - a.context;
        case "params":
          return parseFloat(b.params) - parseFloat(a.params);
        case "inputPrice":
          return a.inputPrice - b.inputPrice;
        case "outputPrice":
          return a.outputPrice - b.outputPrice;
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [search, finetuneOnly, selectedProvider, sortBy]);

  const finetuneableCount = BASE_MODELS.filter(m => m.finetunable).length;

  const formatContext = (ctx: number) => {
    if (ctx >= 1000000) return `${(ctx / 1000000).toFixed(1)}M`;
    if (ctx >= 1000) return `${(ctx / 1000).toFixed(0)}K`;
    return ctx.toString();
  };

  const resetFilters = () => {
    setSearch("");
    setFinetuneOnly(false);
    setSelectedProvider("all");
    setSortBy("name");
  };

  const hasActiveFilters = search || finetuneOnly || selectedProvider !== "all" || sortBy !== "name";

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
          <div className="animate-fade-in">
            <h1 className="text-2xl font-semibold text-foreground">Model Catalog</h1>
            <p className="text-muted-foreground mt-1">
              Explore and compare available models for inference and fine-tuning
            </p>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="animate-fade-in animate-delay-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <TabsList className="bg-secondary border border-border">
                <TabsTrigger value="base" className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Base Models ({BASE_MODELS.length})
                </TabsTrigger>
                <TabsTrigger value="finetuned" className="gap-2">
                  <Cpu className="h-4 w-4" />
                  Fine-tuned ({fineTunedModels?.length || 0})
                </TabsTrigger>
              </TabsList>

              {/* Filters Bar */}
              {activeTab === "base" && (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search models..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 w-[200px] bg-secondary border-border"
                    />
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("gap-2 border-border", showFilters && "bg-secondary")}
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    Advanced Filters
                  </Button>

                  <div className="flex items-center gap-2">
                    <Switch
                      id="finetune-only"
                      checked={finetuneOnly}
                      onCheckedChange={setFinetuneOnly}
                    />
                    <Label htmlFor="finetune-only" className="text-sm cursor-pointer">
                      Finetunable ({finetuneableCount})
                    </Label>
                  </div>

                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetFilters}
                      className="gap-1 text-muted-foreground"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reset All
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Advanced Filters Panel */}
            {showFilters && activeTab === "base" && (
              <div className="flex items-center gap-4 p-4 mt-4 rounded-lg bg-secondary/50 border border-border animate-fade-in">
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">Provider:</Label>
                  <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                    <SelectTrigger className="w-[150px] bg-background border-border">
                      <SelectValue placeholder="All providers" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="all">All Providers</SelectItem>
                      {providers.map(provider => (
                        <SelectItem key={provider} value={provider}>{provider}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">Sort by:</Label>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                    <SelectTrigger className="w-[150px] bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="context">Context Length</SelectItem>
                      <SelectItem value="params">Parameters</SelectItem>
                      <SelectItem value="inputPrice">Input Price</SelectItem>
                      <SelectItem value="outputPrice">Output Price</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Base Models Tab */}
            <TabsContent value="base" className="mt-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredBaseModels.map((model, index) => {
                  const colors = PROVIDER_COLORS[model.provider] || PROVIDER_COLORS.OpenAI;
                  
                  return (
                    <Card
                      key={model.id}
                      className="bg-card border-border hover:border-primary/50 transition-all cursor-pointer group animate-fade-in"
                      style={{ animationDelay: `${index * 30}ms` }}
                      onClick={() => setSelectedModel(model)}
                    >
                      <CardContent className="p-4 space-y-3">
                        {/* Provider & Name */}
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
                              colors.bg, colors.text, colors.border
                            )}>
                              {model.provider}
                            </div>
                            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                              {model.name}
                            </h3>
                          </div>
                          <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-1.5">
                          {model.finetunable && (
                            <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
                              <Sparkles className="h-3 w-3 mr-1" />
                              Finetunable
                            </Badge>
                          )}
                          {model.json && (
                            <Badge variant="outline" className="text-xs bg-info/10 text-info border-info/30">
                              <FileJson className="h-3 w-3 mr-1" />
                              JSON
                            </Badge>
                          )}
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                          <div>
                            <p className="text-xs text-muted-foreground">CONTEXT</p>
                            <p className="text-sm font-medium text-foreground">{formatContext(model.context)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">PARAMS</p>
                            <p className="text-sm font-medium text-foreground">{model.params}</p>
                          </div>
                        </div>

                        {/* Pricing */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">IN:</span>
                            <span className="text-foreground">${model.inputPrice}/M</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">OUT:</span>
                            <span className="text-foreground">${model.outputPrice}/M</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {filteredBaseModels.length === 0 && (
                <div className="text-center py-12">
                  <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No models found</h3>
                  <p className="text-muted-foreground mb-4">Try adjusting your filters</p>
                  <Button variant="outline" onClick={resetFilters}>Reset Filters</Button>
                </div>
              )}
            </TabsContent>

            {/* Fine-tuned Models Tab */}
            <TabsContent value="finetuned" className="mt-6">
              {ftLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="bg-card border-border">
                      <CardContent className="p-4 space-y-3">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-6 w-32" />
                        <div className="flex gap-2">
                          <Skeleton className="h-5 w-20" />
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-2">
                          <Skeleton className="h-8 w-full" />
                          <Skeleton className="h-8 w-full" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : fineTunedModels && fineTunedModels.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {fineTunedModels.map((model, index) => (
                    <Card
                      key={model.id}
                      className="bg-card border-border hover:border-primary/50 transition-all cursor-pointer group animate-fade-in"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-primary/10 text-primary border-primary/30">
                              Fine-tuned
                            </div>
                            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                              {model.name}
                            </h3>
                          </div>
                          <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>

                        <p className="text-xs text-muted-foreground">Base: {model.base_model}</p>

                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                          <div>
                            <p className="text-xs text-muted-foreground">CONTEXT</p>
                            <p className="text-sm font-medium text-foreground">
                              {model.context_length ? formatContext(model.context_length) : "-"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">STATUS</p>
                            <p className={cn(
                              "text-sm font-medium",
                              model.is_deployed ? "text-success" : "text-muted-foreground"
                            )}>
                              {model.is_deployed ? "Deployed" : "Not deployed"}
                            </p>
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground">
                          ID: <code className="font-mono">{model.model_id}</code>
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Cpu className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No fine-tuned models yet</h3>
                  <p className="text-muted-foreground">Complete a fine-tuning job to create your first custom model</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* Model Detail Modal */}
      <Dialog open={!!selectedModel} onOpenChange={() => setSelectedModel(null)}>
        <DialogContent className="max-w-lg">
          {selectedModel && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
                    PROVIDER_COLORS[selectedModel.provider]?.bg,
                    PROVIDER_COLORS[selectedModel.provider]?.text,
                    PROVIDER_COLORS[selectedModel.provider]?.border
                  )}>
                    {selectedModel.provider}
                  </div>
                  {selectedModel.finetunable && (
                    <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
                      Finetunable
                    </Badge>
                  )}
                </div>
                <DialogTitle className="text-xl">{selectedModel.name}</DialogTitle>
                <DialogDescription>{selectedModel.description}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-secondary">
                    <p className="text-xs text-muted-foreground mb-1">Model ID</p>
                    <code className="text-sm font-mono text-foreground">{selectedModel.id}</code>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary">
                    <p className="text-xs text-muted-foreground mb-1">Parameters</p>
                    <p className="text-sm font-medium text-foreground">{selectedModel.params}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary">
                    <p className="text-xs text-muted-foreground mb-1">Context Window</p>
                    <p className="text-sm font-medium text-foreground">{formatContext(selectedModel.context)} tokens</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary">
                    <p className="text-xs text-muted-foreground mb-1">JSON Mode</p>
                    <p className="text-sm font-medium text-foreground">{selectedModel.json ? "Supported" : "Not supported"}</p>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                  <h4 className="text-sm font-medium text-foreground mb-3">Pricing (per million tokens)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Input</p>
                      <p className="text-lg font-semibold text-foreground">${selectedModel.inputPrice}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Output</p>
                      <p className="text-lg font-semibold text-foreground">${selectedModel.outputPrice}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1 gap-2">
                    <Sparkles className="h-4 w-4" />
                    Use in Playground
                  </Button>
                  {selectedModel.finetunable && (
                    <Button variant="outline" className="flex-1 gap-2">
                      <Cpu className="h-4 w-4" />
                      Fine-tune
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ModelsCatalog;
