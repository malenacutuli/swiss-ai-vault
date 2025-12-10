import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TemplateCard } from "@/components/templates/TemplateCard";
import { TemplateDetailModal } from "@/components/templates/TemplateDetailModal";
import { GenerateDatasetModal } from "@/components/templates/GenerateDatasetModal";
import { 
  useFinetuningTemplates, 
  TEMPLATE_LANGUAGES, 
  TEMPLATE_DOMAINS 
} from "@/hooks/useFinetuningTemplates";
import { Filter, X, LayoutTemplate } from "lucide-react";

const Templates = () => {
  const { t } = useTranslation();
  const [languageFilter, setLanguageFilter] = useState("all");
  const [domainFilter, setDomainFilter] = useState("all");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [generateTemplateId, setGenerateTemplateId] = useState<string | null>(null);
  const { data: templates, isLoading } = useFinetuningTemplates({
    language: languageFilter,
    domain: domainFilter,
  });

  const hasFilters = languageFilter !== "all" || domainFilter !== "all";

  const clearFilters = () => {
    setLanguageFilter("all");
    setDomainFilter("all");
  };

  return (
    <div className="p-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Fine-tuning Templates</h1>
            <p className="text-muted-foreground mt-1">
              Pre-built templates for European languages and industries
            </p>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 mb-6 p-4 rounded-lg bg-card border">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={languageFilter} onValueChange={setLanguageFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={domainFilter} onValueChange={setDomainFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select domain" />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_DOMAINS.map((domain) => (
                  <SelectItem key={domain.value} value={domain.value}>
                    {domain.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasFilters && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearFilters}
                className="gap-1"
              >
                <X className="h-4 w-4" />
                Clear filters
              </Button>
            )}

            <div className="ml-auto text-sm text-muted-foreground">
              {templates?.length ?? 0} templates
            </div>
          </div>

          {/* Template Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : templates && templates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onClick={() => setSelectedTemplateId(template.id)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <LayoutTemplate className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-1">No templates found</h3>
              <p className="text-muted-foreground mb-4">
                No templates match your current filters
              </p>
              {hasFilters && (
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </div>
          )}

      {/* Template Detail Modal */}
      <TemplateDetailModal
        templateId={selectedTemplateId}
        onClose={() => setSelectedTemplateId(null)}
        onGenerateDataset={(id) => setGenerateTemplateId(id)}
      />

      {/* Generate Dataset Modal */}
      <GenerateDatasetModal
        templateId={generateTemplateId}
        onClose={() => setGenerateTemplateId(null)}
      />
    </div>
  );
};

export default Templates;
