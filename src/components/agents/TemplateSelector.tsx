/**
 * Template Selector Modal
 * Allows users to choose a project template for sandbox initialization
 */

import React, { useState } from 'react';
import { 
  Globe, 
  Atom, 
  Triangle, 
  Rocket, 
  Code2, 
  BarChart3, 
  FolderOpen,
  Check,
  FileCode,
  Folder,
  ChevronRight
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { TEMPLATES, Template } from '@/lib/agents/templates/TemplateRegistry';
import { BrowserTemplateInitializer } from '@/lib/agents/templates/TemplateInitializer';

interface TemplateSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: Template) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  web: 'Web Applications',
  api: 'Backend APIs',
  data: 'Data Science',
  other: 'Other',
};

const ICON_MAP: Record<string, React.ReactNode> = {
  Globe: <Globe className="w-5 h-5" />,
  Atom: <Atom className="w-5 h-5" />,
  Triangle: <Triangle className="w-5 h-5" />,
  Rocket: <Rocket className="w-5 h-5" />,
  Code2: <Code2 className="w-5 h-5" />,
  BarChart3: <BarChart3 className="w-5 h-5" />,
  FolderOpen: <FolderOpen className="w-5 h-5" />,
};

export function TemplateSelector({ open, onOpenChange, onSelect }: TemplateSelectorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  
  const categories = ['web', 'api', 'data', 'other'];
  const selectedTemplate = selectedId ? TEMPLATES.find(t => t.id === selectedId) : null;

  const getIcon = (iconName: string) => {
    return ICON_MAP[iconName] || <FolderOpen className="w-5 h-5" />;
  };

  const handleConfirm = () => {
    if (selectedTemplate) {
      onSelect(selectedTemplate);
      onOpenChange(false);
      setSelectedId(null);
      setShowPreview(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedId(null);
    setShowPreview(false);
  };

  const fileTree = selectedTemplate 
    ? BrowserTemplateInitializer.getFileTree(selectedTemplate)
    : [];

  const renderFileTree = (items: any[], depth = 0) => {
    return items.map((item, index) => (
      <div key={`${item.name}-${index}`} style={{ paddingLeft: `${depth * 16}px` }}>
        <div className="flex items-center gap-2 py-1 text-sm">
          {item.type === 'folder' ? (
            <>
              <Folder className="w-4 h-4 text-blue-500" />
              <span className="text-muted-foreground">{item.name}</span>
            </>
          ) : (
            <>
              <FileCode className="w-4 h-4 text-gray-400" />
              <span>{item.name}</span>
            </>
          )}
        </div>
        {item.children && renderFileTree(item.children, depth + 1)}
      </div>
    ));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] p-0 gap-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="text-xl">Choose a Template</DialogTitle>
          <DialogDescription>
            Select a project template to initialize your sandbox
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Template List */}
          <ScrollArea className="flex-1 p-6 border-r">
            <div className="space-y-6">
              {categories.map(category => {
                const categoryTemplates = TEMPLATES.filter(t => t.category === category);
                if (categoryTemplates.length === 0) return null;

                return (
                  <div key={category}>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">
                      {CATEGORY_LABELS[category]}
                    </h3>

                    <div className="grid grid-cols-1 gap-2">
                      {categoryTemplates.map(template => (
                        <button
                          key={template.id}
                          onClick={() => {
                            setSelectedId(template.id);
                            setShowPreview(true);
                          }}
                          className={cn(
                            "flex items-start gap-3 p-4 rounded-lg border text-left transition-all duration-200",
                            selectedId === template.id
                              ? "border-[#1D4E5F] bg-[#1D4E5F]/5 ring-1 ring-[#1D4E5F]"
                              : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
                          )}
                        >
                          <div className={cn(
                            "p-2 rounded-lg shrink-0",
                            selectedId === template.id
                              ? "bg-[#1D4E5F]/10 text-[#1D4E5F]"
                              : "bg-muted text-muted-foreground"
                          )}>
                            {getIcon(template.iconName)}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {template.displayName}
                              </span>
                              {selectedId === template.id && (
                                <Check className="w-4 h-4 text-[#1D4E5F]" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {template.description}
                            </p>
                            {template.features.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {template.features.slice(0, 4).map(feature => (
                                  <Badge 
                                    key={feature}
                                    variant="secondary"
                                    className="text-xs px-1.5 py-0"
                                  >
                                    {feature}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>

                          <ChevronRight className={cn(
                            "w-4 h-4 text-muted-foreground transition-transform shrink-0",
                            selectedId === template.id && "text-[#1D4E5F]"
                          )} />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Preview Panel */}
          <div className="w-80 bg-muted/30 flex flex-col">
            {selectedTemplate ? (
              <>
                <div className="p-4 border-b">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#1D4E5F]/10 text-[#1D4E5F]">
                      {getIcon(selectedTemplate.iconName)}
                    </div>
                    <div>
                      <h4 className="font-medium">{selectedTemplate.displayName}</h4>
                      <p className="text-xs text-muted-foreground">
                        {selectedTemplate.files.length} files
                      </p>
                    </div>
                  </div>
                </div>

                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {/* File Tree */}
                    <div>
                      <h5 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                        File Structure
                      </h5>
                      <div className="bg-background rounded-lg border p-3">
                        {renderFileTree(fileTree)}
                      </div>
                    </div>

                    {/* Scripts */}
                    {Object.keys(selectedTemplate.scripts).length > 0 && (
                      <div>
                        <h5 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                          Scripts
                        </h5>
                        <div className="bg-background rounded-lg border p-3 space-y-1">
                          {Object.entries(selectedTemplate.scripts).map(([name, cmd]) => (
                            <div key={name} className="flex items-center gap-2 text-sm">
                              <code className="text-[#1D4E5F] font-mono">{name}</code>
                              <span className="text-muted-foreground">→</span>
                              <code className="text-muted-foreground font-mono text-xs truncate">
                                {cmd}
                              </code>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Dependencies */}
                    {Object.keys(selectedTemplate.dependencies).length > 0 && (
                      <div>
                        <h5 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                          Dependencies
                        </h5>
                        <div className="flex flex-wrap gap-1">
                          {Object.keys(selectedTemplate.dependencies).map(dep => (
                            <Badge key={dep} variant="outline" className="text-xs">
                              {dep}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Dev Dependencies */}
                    {Object.keys(selectedTemplate.devDependencies).length > 0 && (
                      <div>
                        <h5 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                          Dev Dependencies
                        </h5>
                        <div className="flex flex-wrap gap-1">
                          {Object.keys(selectedTemplate.devDependencies).map(dep => (
                            <Badge key={dep} variant="outline" className="text-xs font-mono">
                              {dep}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <p className="text-sm">Select a template to preview</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t bg-muted/30">
          <Button
            variant="outline"
            onClick={handleClose}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedId}
            className="bg-[#1D4E5F] hover:bg-[#1D4E5F]/90"
          >
            Use Template
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TemplateSelector;
