import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, ArrowRight } from "@/icons";
import { SwissIconTile } from "@/components/ui/swiss";
import { getDomainIcon } from "@/lib/domain-icons";
import type { TemplateSummary } from "@/hooks/useFinetuningTemplates";

interface TemplateCardProps {
  template: TemplateSummary;
  onClick: () => void;
}

const getDifficultyColor = (difficulty: string | null) => {
  switch (difficulty) {
    case "beginner":
      return "bg-success/20 text-success border-success/30";
    case "intermediate":
      return "bg-warning/20 text-warning border-warning/30";
    case "advanced":
      return "bg-destructive/20 text-destructive border-destructive/30";
    default:
      return "bg-muted text-muted-foreground";
  }
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

export const TemplateCard = ({ template, onClick }: TemplateCardProps) => {
  return (
    <Card 
      className="group cursor-pointer transition-all duration-200 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {(() => {
              const DomainIcon = getDomainIcon(template.domain);
              return (
                <SwissIconTile size="sm" variant="muted">
                  <DomainIcon className="h-4 w-4" />
                </SwissIconTile>
              );
            })()}
            <div>
              <CardTitle className="text-base group-hover:text-primary transition-colors">
                {template.name}
              </CardTitle>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <Badge variant="outline" className="text-xs">
            {template.language}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {getDomainLabel(template.domain)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <CardDescription className="line-clamp-2 text-sm">
          {template.description}
        </CardDescription>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={`text-xs capitalize ${getDifficultyColor(template.difficulty)}`}
            >
              {template.difficulty}
            </Badge>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {template.estimated_time}
            </div>
          </div>
        </div>

        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full mt-2 group-hover:bg-primary/10 group-hover:text-primary"
        >
          Use Template
          <ArrowRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-1" />
        </Button>
      </CardContent>
    </Card>
  );
};
