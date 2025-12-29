import { useState, useMemo } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  SlidersHorizontal,
  ArrowUpRight,
  RotateCcw,
  Cpu,
  Sparkles,
  FileJson,
  Code,
  Globe,
  Shield,
  AlertTriangle,
  CheckCircle,
} from "@/icons";

// Provider brand colors
const PROVIDER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  OpenAI: { bg: "bg-emerald-500/10", text: "text-emerald-500", border: "border-emerald-500/30" },
  Anthropic: { bg: "bg-orange-500/10", text: "text-orange-500", border: "border-orange-500/30" },
  Google: { bg: "bg-blue-500/10", text: "text-blue-500", border: "border-blue-500/30" },
  Meta: { bg: "bg-indigo-500/10", text: "text-indigo-500", border: "border-indigo-500/30" },
  Mistral: { bg: "bg-purple-500/10", text: "text-purple-500", border: "border-purple-500/30" },
  DeepSeek: { bg: "bg-cyan-500/10", text: "text-cyan-500", border: "border-cyan-500/30" },
  Qwen: { bg: "bg-pink-500/10", text: "text-pink-500", border: "border-pink-500/30" },
  Microsoft: { bg: "bg-blue-600/10", text: "text-blue-400", border: "border-blue-400/30" },
  Cohere: { bg: "bg-red-500/10", text: "text-red-500", border: "border-red-500/30" },
  BigCode: { bg: "bg-yellow-500/10", text: "text-yellow-500", border: "border-yellow-500/30" },
  "01.AI": { bg: "bg-violet-500/10", text: "text-violet-500", border: "border-violet-500/30" },
  "Prem AI": { bg: "bg-teal-500/10", text: "text-teal-500", border: "border-teal-500/30" },
};

// License info
const LICENSE_INFO: Record<string, { label: string; needsApproval: boolean; color: string }> = {
  "apache-2.0": { label: "Apache 2.0", needsApproval: false, color: "text-green-500" },
  mit: { label: "MIT", needsApproval: false, color: "text-green-500" },
  gemma: { label: "Gemma License", needsApproval: false, color: "text-green-500" },
  llama: { label: "Llama License", needsApproval: true, color: "text-yellow-500" },
  bigcode: { label: "BigCode", needsApproval: false, color: "text-green-500" },
  c4ai: { label: "C4AI License", needsApproval: true, color: "text-yellow-500" },
  proprietary: { label: "Proprietary", needsApproval: false, color: "text-blue-500" },
  open: { label: "Open", needsApproval: false, color: "text-green-500" },
};

interface BaseModel {
  id: string;
  name: string;
  provider: string;
  parameters: string | null;
  context_length: number | null;
  is_finetunable: boolean;
  is_active: boolean;
  input_price: number;
  output_price: number;
  license_type: string;
  category: string;
  description: string | null;
}

type SortOption = "name" | "context" | "params" | "inputPrice" | "outputPrice";

const ModelsCatalog = () => {
  const [activeTab, setActiveTab] = useState("base");
  const [search, setSearch] = useState("");
  const [finetuneOnly, setFinetuneOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [selectedProvider, setSelectedProvider] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedLicense, setSelectedLicense] = useState<string>("all");
  const [selectedModel, setSelectedModel] = useState<BaseModel | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const { models: fineTunedModels, loading: ftLoading } = useModels();

  // Fetch base models from database
  const { data: baseModels = [], isLoading: baseLoading } = useQuery({
    queryKey: ["base-models"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("base_models")
        .select("*")
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      return data as BaseModel[];
    },
  });

  const providers = useMemo(() => {
    const providerSet = new Set(baseModels.map(m => m.provider));
    return Array.from(providerSet).sort();
  }, [baseModels]);

  const categories = useMemo(() => {
    const categorySet = new Set(baseModels.map(m => m.category));
    return Array.from(categorySet).sort();
  }, [baseModels]);

  const licenses = useMemo(() => {
    const licenseSet = new Set(baseModels.map(m => m.license_type));
    return Array.from(licenseSet).sort();
  }, [baseModels]);

  const filteredBaseModels = useMemo(() => {
    let filtered = baseModels;

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(m => 
        m.name.toLowerCase().includes(searchLower) || 
        m.provider.toLowerCase().includes(searchLower) ||
        m.id.toLowerCase().includes(searchLower)
      );
    }

    if (finetuneOnly) {
      filtered = filtered.filter(m => m.is_finetunable);
    }

    if (selectedProvider !== "all") {
      filtered = filtered.filter(m => m.provider === selectedProvider);
    }

    if (selectedCategory !== "all") {
      filtered = filtered.filter(m => m.category === selectedCategory);
    }

    if (selectedLicense !== "all") {
      filtered = filtered.filter(m => m.license_type === selectedLicense);
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "context":
          return (b.context_length || 0) - (a.context_length || 0);
        case "params":
          return parseFloat(b.parameters || "0") - parseFloat(a.parameters || "0");
        case "inputPrice":
          return a.input_price - b.input_price;
        case "outputPrice":
          return a.output_price - b.output_price;
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [baseModels, search, finetuneOnly, selectedProvider, selectedCategory, selectedLicense, sortBy]);

  const finetuneableCount = baseModels.filter(m => m.is_finetunable).length;

  const formatContext = (ctx: number | null) => {
    if (!ctx) return "-";
    if (ctx >= 1000000) return `${(ctx / 1000000).toFixed(1)}M`;
    if (ctx >= 1000) return `${(ctx / 1000).toFixed(0)}K`;
    return ctx.toString();
  };

  const resetFilters = () => {
    setSearch("");
    setFinetuneOnly(false);
    setSelectedProvider("all");
    setSelectedCategory("all");
    setSelectedLicense("all");
    setSortBy("name");
  };

  const hasActiveFilters = search || finetuneOnly || selectedProvider !== "all" || selectedCategory !== "all" || selectedLicense !== "all" || sortBy !== "name";

  const getLicenseBadge = (licenseType: string) => {
    const info = LICENSE_INFO[licenseType] || LICENSE_INFO.open;
    return (
      <Badge variant="outline" className={cn("text-xs gap-1", info.color)}>
        {info.needsApproval ? (
          <AlertTriangle className="h-3 w-3" />
        ) : (
          <CheckCircle className="h-3 w-3" />
        )}
        {info.needsApproval ? "Requires License" : "No Approval"}
      </Badge>
    );
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "code":
        return <Code className="h-3 w-3" />;
      case "multilingual":
        return <Globe className="h-3 w-3" />;
      default:
        return <Sparkles className="h-3 w-3" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
          {/* Page Header */}
          <div className="animate-fade-in">
            <h1 className="text-2xl font-semibold text-foreground">Model Catalog</h1>
            <p className="text-muted-foreground mt-1">
              Explore {baseModels.length} models for inference and fine-tuning
            </p>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="animate-fade-in animate-delay-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <TabsList className="bg-secondary border border-border">
                <TabsTrigger value="base" className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Base Models ({baseModels.length})
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
                    Filters
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
                      Reset
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Advanced Filters Panel */}
            {showFilters && activeTab === "base" && (
              <div className="flex items-center gap-4 p-4 mt-4 rounded-lg bg-secondary/50 border border-border animate-fade-in flex-wrap">
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">Provider:</Label>
                  <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                    <SelectTrigger className="w-[140px] bg-background border-border">
                      <SelectValue placeholder="All" />
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
                  <Label className="text-sm text-muted-foreground">Category:</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-[140px] bg-background border-border">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat} className="capitalize">{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">License:</Label>
                  <Select value={selectedLicense} onValueChange={setSelectedLicense}>
                    <SelectTrigger className="w-[140px] bg-background border-border">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="all">All Licenses</SelectItem>
                      {licenses.map(lic => (
                        <SelectItem key={lic} value={lic}>
                          {LICENSE_INFO[lic]?.label || lic}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">Sort by:</Label>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                    <SelectTrigger className="w-[140px] bg-background border-border">
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
              {baseLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <Card key={i} className="bg-card border-border">
                      <CardContent className="p-4 space-y-3">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-6 w-32" />
                        <div className="flex gap-2">
                          <Skeleton className="h-5 w-20" />
                          <Skeleton className="h-5 w-24" />
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-2">
                          <Skeleton className="h-8 w-full" />
                          <Skeleton className="h-8 w-full" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredBaseModels.map((model, index) => {
                    const colors = PROVIDER_COLORS[model.provider] || PROVIDER_COLORS.OpenAI;
                    
                    return (
                      <Card
                        key={model.id}
                        className="bg-card border-border hover:border-primary/50 transition-all cursor-pointer group animate-fade-in"
                        style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
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
                            {model.is_finetunable && (
                              <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
                                <Sparkles className="h-3 w-3 mr-1" />
                                Finetunable
                              </Badge>
                            )}
                            {model.category === "code" && (
                              <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/30">
                                <Code className="h-3 w-3 mr-1" />
                                Code
                              </Badge>
                            )}
                            {model.category === "multilingual" && (
                              <Badge variant="outline" className="text-xs bg-violet-500/10 text-violet-500 border-violet-500/30">
                                <Globe className="h-3 w-3 mr-1" />
                                Multilingual
                              </Badge>
                            )}
                          </div>

                          {/* License Badge */}
                          <div>
                            {getLicenseBadge(model.license_type)}
                          </div>

                          {/* Stats */}
                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                            <div>
                              <p className="text-xs text-muted-foreground">CONTEXT</p>
                              <p className="text-sm font-medium text-foreground">{formatContext(model.context_length)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">PARAMS</p>
                              <p className="text-sm font-medium text-foreground">{model.parameters || "-"}</p>
                            </div>
                          </div>

                          {/* Pricing */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">IN:</span>
                              <span className="text-foreground">${model.input_price}/M</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">OUT:</span>
                              <span className="text-foreground">${model.output_price}/M</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {!baseLoading && filteredBaseModels.length === 0 && (
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

      {/* Model Detail Modal */}
      <Dialog open={!!selectedModel} onOpenChange={() => setSelectedModel(null)}>
        <DialogContent className="max-w-lg">
          {selectedModel && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <div className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
                    PROVIDER_COLORS[selectedModel.provider]?.bg,
                    PROVIDER_COLORS[selectedModel.provider]?.text,
                    PROVIDER_COLORS[selectedModel.provider]?.border
                  )}>
                    {selectedModel.provider}
                  </div>
                  {selectedModel.is_finetunable && (
                    <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
                      Finetunable
                    </Badge>
                  )}
                  {getLicenseBadge(selectedModel.license_type)}
                </div>
                <DialogTitle className="text-xl">{selectedModel.name}</DialogTitle>
                <DialogDescription>{selectedModel.description || `${selectedModel.provider} ${selectedModel.parameters} parameter model`}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-secondary">
                    <p className="text-xs text-muted-foreground mb-1">Model ID</p>
                    <code className="text-sm font-mono text-foreground">{selectedModel.id}</code>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary">
                    <p className="text-xs text-muted-foreground mb-1">Parameters</p>
                    <p className="text-sm font-medium text-foreground">{selectedModel.parameters || "N/A"}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary">
                    <p className="text-xs text-muted-foreground mb-1">Context Window</p>
                    <p className="text-sm font-medium text-foreground">{formatContext(selectedModel.context_length)} tokens</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary">
                    <p className="text-xs text-muted-foreground mb-1">Category</p>
                    <p className="text-sm font-medium text-foreground capitalize flex items-center gap-1">
                      {getCategoryIcon(selectedModel.category)}
                      {selectedModel.category}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                  <h4 className="text-sm font-medium text-foreground mb-3">Pricing (per million tokens)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Input</p>
                      <p className="text-lg font-semibold text-foreground">${selectedModel.input_price}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Output</p>
                      <p className="text-lg font-semibold text-foreground">${selectedModel.output_price}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1 gap-2">
                    <Sparkles className="h-4 w-4" />
                    Use in Playground
                  </Button>
                  {selectedModel.is_finetunable && (
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
