import { motion } from 'framer-motion';
import { Search, Sparkles, Code, FileText, BarChart3, Users, Plus } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { AgentTemplate } from '@/hooks/useCustomAgents';

const iconMap: Record<string, React.ElementType> = {
  search: Search,
  code: Code,
  'file-text': FileText,
  'bar-chart': BarChart3,
  users: Users,
  sparkles: Sparkles,
};

interface AgentTemplateSelectorProps {
  templates: AgentTemplate[];
  onSelectTemplate: (template: AgentTemplate) => void;
  onCreateBlank: () => void;
  isLoading?: boolean;
}

export function AgentTemplateSelector({
  templates,
  onSelectTemplate,
  onCreateBlank,
  isLoading,
}: AgentTemplateSelectorProps) {
  const [search, setSearch] = useState('');

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.description.toLowerCase().includes(search.toLowerCase())
  );

  const categories = [...new Set(templates.map(t => t.category))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">Create a Custom Agent</h2>
        <p className="text-muted-foreground">
          Start from a template or create a blank agent
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md mx-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Blank Agent Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md mx-auto"
      >
        <Card
          className={cn(
            "cursor-pointer border-dashed border-2 hover:border-primary/50 transition-colors",
            "bg-gradient-to-br from-background to-muted/30"
          )}
          onClick={onCreateBlank}
        >
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
              <Plus className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-medium">Start from Scratch</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Create a fully customized agent with your own instructions
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Templates Grid */}
      {categories.map(category => {
        const categoryTemplates = filteredTemplates.filter(t => t.category === category);
        if (categoryTemplates.length === 0) return null;

        return (
          <div key={category} className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {category}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryTemplates.map((template, i) => {
                const IconComponent = iconMap[template.icon] || Sparkles;
                return (
                  <motion.div
                    key={template.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card
                      className={cn(
                        "cursor-pointer hover:border-primary/50 transition-all hover:shadow-md",
                        isLoading && "opacity-50 pointer-events-none"
                      )}
                      onClick={() => onSelectTemplate(template)}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <IconComponent className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-medium truncate">{template.name}</h4>
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                              {template.description}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {template.enabled_tools.slice(0, 3).map(tool => (
                                <span
                                  key={tool}
                                  className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                                >
                                  {tool.replace(/_/g, ' ')}
                                </span>
                              ))}
                              {template.enabled_tools.length > 3 && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                  +{template.enabled_tools.length - 3}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        );
      })}

      {filteredTemplates.length === 0 && search && (
        <div className="text-center py-8 text-muted-foreground">
          No templates found matching "{search}"
        </div>
      )}
    </div>
  );
}
