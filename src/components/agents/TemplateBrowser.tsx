import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Search,
  FileText,
  BarChart,
  Scale,
  Presentation,
  Mail,
  Globe,
  Code,
  Palette,
  GraduationCap,
  User,
  Loader2,
  Clock,
  Sparkles,
} from 'lucide-react';

export interface ActionTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  prompt_template: string;
  required_inputs: any[] | null;
  output_types: any[] | null;
  estimated_duration_seconds: number | null;
  usage_count: number | null;
  is_featured: boolean | null;
  icon: string | null;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  finance: BarChart,
  legal: Scale,
  research: Search,
  presentations: Presentation,
  documents: FileText,
  marketing: Mail,
  automation: Code,
  design: Palette,
  education: GraduationCap,
  personal: User,
  data: BarChart,
  sales: Globe,
  meetings: FileText,
  reporting: BarChart,
};

const CATEGORY_LABELS: Record<string, string> = {
  finance: 'Finance & Analysis',
  legal: 'Legal & Compliance',
  research: 'Research & Intelligence',
  presentations: 'Presentations',
  documents: 'Documents & Writing',
  marketing: 'Marketing & Growth',
  automation: 'Automation & Workflows',
  design: 'Design & Creative',
  education: 'Education & Training',
  personal: 'Personal Productivity',
  data: 'Data & Analytics',
  sales: 'Sales Operations',
  meetings: 'Meetings & Notes',
  reporting: 'Reporting & Dashboards',
};

interface TemplateBrowserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (template: ActionTemplate) => void;
}

export function TemplateBrowser({
  open,
  onOpenChange,
  onSelectTemplate,
}: TemplateBrowserProps) {
  const [templates, setTemplates] = useState<ActionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<ActionTemplate | null>(null);

  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open]);

  const fetchTemplates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('action_templates')
      .select('*')
      .eq('is_public', true)
      .order('usage_count', { ascending: false });

    if (!error && data) {
      setTemplates(data as ActionTemplate[]);
    }
    setLoading(false);
  };

  const categories = ['all', ...new Set(templates.map((t) => t.category).filter(Boolean) as string[])];

  const filteredTemplates = templates.filter((t) => {
    const matchesSearch =
      !searchQuery ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleUseTemplate = (template: ActionTemplate) => {
    onSelectTemplate(template);
    onOpenChange(false);
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '~1 min';
    const mins = Math.ceil(seconds / 60);
    return mins === 1 ? '~1 min' : `~${mins} mins`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Action Templates
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="px-6 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="flex gap-4 flex-1 overflow-hidden px-6">
          {/* Categories Sidebar */}
          <div className="w-48 shrink-0">
            <ScrollArea className="h-full pr-2">
              <div className="space-y-1">
                {categories.map((cat) => {
                  const Icon = CATEGORY_ICONS[cat] || FileText;
                  const count =
                    cat === 'all'
                      ? templates.length
                      : templates.filter((t) => t.category === cat).length;

                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left',
                        selectedCategory === cat
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted text-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate">
                        {cat === 'all' ? 'All Templates' : CATEGORY_LABELS[cat] || cat}
                      </span>
                      <Badge
                        variant={selectedCategory === cat ? 'secondary' : 'outline'}
                        className="text-xs shrink-0"
                      >
                        {count}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Templates Grid */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <FileText className="h-12 w-12 mb-3 opacity-50" />
                  <p className="text-sm">No templates found</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 pr-4 pb-4">
                  {filteredTemplates.map((template) => (
                    <div
                      key={template.id}
                      className={cn(
                        'p-4 border rounded-lg cursor-pointer transition-all',
                        'hover:border-primary/50 hover:shadow-sm',
                        selectedTemplate?.id === template.id && 'border-primary bg-primary/5'
                      )}
                      onClick={() => setSelectedTemplate(template)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-sm line-clamp-1">{template.name}</h4>
                        {template.is_featured && (
                          <Badge variant="default" className="text-xs shrink-0 ml-2">
                            Featured
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                        {template.description || 'No description'}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDuration(template.estimated_duration_seconds)}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUseTemplate(template);
                          }}
                        >
                          Use
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* Template Preview */}
        {selectedTemplate && (
          <div className="border-t border-border px-6 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground">{selectedTemplate.name}</h3>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {selectedTemplate.description}
                </p>

                {selectedTemplate.required_inputs && selectedTemplate.required_inputs.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">
                      Required Inputs:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {(selectedTemplate.required_inputs as any[]).map((input: any, i: number) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {input.name || input}
                          {input.required && <span className="text-destructive ml-0.5">*</span>}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <Button onClick={() => handleUseTemplate(selectedTemplate)}>
                Use This Template
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
