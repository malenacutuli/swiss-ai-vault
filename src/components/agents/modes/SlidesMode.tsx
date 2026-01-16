import { 
  Rocket, 
  Brain, 
  Shield, 
  TrendingUp, 
  ArrowUpRight, 
  Upload,
  Crown,
  Presentation,
  Sparkles,
  Check
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { SLIDE_STYLES } from '@/lib/slide-styles';
import { SlideStyleName } from '@/types/slides';
import { PRESENTATION_TEMPLATES } from '@/lib/integrations/nanoBanana';

interface SamplePrompt {
  id: number;
  text: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SAMPLE_PROMPTS: SamplePrompt[] = [
  {
    id: 1,
    text: "Design a pitch deck for a startup seeking funding",
    icon: Rocket
  },
  {
    id: 2,
    text: "Create a presentation on the impact of AI on the future of work",
    icon: Brain
  },
  {
    id: 3,
    text: "Prepare a training module on cybersecurity best practices",
    icon: Shield
  },
  {
    id: 4,
    text: "Create a sales presentation for a B2B software solution",
    icon: TrendingUp
  }
];

const SLIDE_COUNTS = [4, 8, 12, 16, 20];

interface SlidesModeProps {
  onPromptSelect: (text: string) => void;
  onTemplateSelect: (templateId: string) => void;
  selectedTemplate: string;
  slideCount: number;
  onSlideCountChange: (count: number) => void;
}

// Template preview component (renders a mini slide preview using actual style colors)
function TemplatePreview({ styleId }: { styleId: SlideStyleName }) {
  const style = SLIDE_STYLES[styleId];
  if (!style) return null;
  
  return (
    <div 
      className="w-full h-full flex flex-col"
      style={{ backgroundColor: style.colors.background }}
    >
      {/* Header bar */}
      <div 
        className="h-2 w-full"
        style={{ backgroundColor: style.colors.primary }}
      />
      
      {/* Content area */}
      <div className="flex-1 p-2 flex flex-col justify-between">
        {/* Title placeholder */}
        <div className="space-y-1">
          <div 
            className="h-2 w-3/4 rounded-sm"
            style={{ backgroundColor: style.colors.primary }}
          />
          <div 
            className="h-1 w-1/2 rounded-sm opacity-60"
            style={{ backgroundColor: style.colors.muted }}
          />
        </div>
        
        {/* Content placeholders */}
        <div className="flex gap-1 flex-1 mt-2">
          <div 
            className="flex-1 rounded-sm opacity-30"
            style={{ backgroundColor: style.colors.secondary }}
          />
          <div 
            className="w-1/3 rounded-sm opacity-50"
            style={{ backgroundColor: style.colors.accent }}
          />
        </div>
        
        {/* Footer accent */}
        <div 
          className="h-0.5 w-full mt-1"
          style={{ backgroundColor: style.colors.primary }}
        />
      </div>
    </div>
  );
}

export function SlidesMode({ 
  onPromptSelect,
  onTemplateSelect,
  selectedTemplate,
  slideCount,
  onSlideCountChange
}: SlidesModeProps) {
  const [hoveredStyle, setHoveredStyle] = useState<SlideStyleName | null>(null);
  
  const handleImportTemplate = () => {
    toast.info('Template import coming soon', {
      description: 'You will be able to import your own PowerPoint templates',
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Sample Prompts */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-[#1D4E5F]" />
          <h3 className="text-sm font-medium text-[#666666]">Sample prompts</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SAMPLE_PROMPTS.map(prompt => {
            const Icon = prompt.icon;
            return (
              <button
                key={prompt.id}
                onClick={() => onPromptSelect(prompt.text)}
                className="text-left p-4 bg-white border border-[#E5E5E5] rounded-xl hover:border-[#1D4E5F] hover:shadow-sm transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-[#F8FAFB] group-hover:bg-[#1D4E5F]/10 transition-colors">
                    <Icon className="w-4 h-4 text-[#666666] group-hover:text-[#1D4E5F]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-[#4A4A4A] group-hover:text-[#1A1A1A]">
                      {prompt.text}
                    </p>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-[#CCCCCC] group-hover:text-[#1D4E5F] transition-colors" />
                </div>
              </button>
            );
          })}
        </div>
      </section>
      
      {/* Template Gallery - 15 Manus Professional Styles */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Presentation className="w-4 h-4 text-[#1D4E5F]" />
            <h3 className="text-sm font-medium text-[#666666]">
              Choose a style <span className="text-xs text-[#999999]">({PRESENTATION_TEMPLATES.length} styles)</span>
            </h3>
          </div>
          <div className="flex items-center gap-3">
            {/* Slide count selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#999999]">Slides:</span>
              <select
                value={slideCount}
                onChange={(e) => onSlideCountChange(Number(e.target.value))}
                className="text-sm border border-[#E5E5E5] rounded-lg px-3 py-1.5 bg-white text-[#4A4A4A] focus:outline-none focus:ring-2 focus:ring-[#1D4E5F]/20 focus:border-[#1D4E5F]"
              >
                {SLIDE_COUNTS.map(count => (
                  <option key={count} value={count}>{count}</option>
                ))}
              </select>
            </div>
            
            {/* Import template */}
            <Button 
              variant="outline" 
              size="sm"
              className="text-[#666666] hover:text-[#1A1A1A] border-[#E5E5E5] hover:border-[#1D4E5F] hover:bg-[#F8FAFB]"
              onClick={handleImportTemplate}
            >
              <Upload className="w-4 h-4 mr-1.5" strokeWidth={1.5} />
              Import template
            </Button>
          </div>
        </div>
        
        {/* Template Grid - 15 Manus Styles */}
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          {PRESENTATION_TEMPLATES.map(template => (
            <button
              key={template.id}
              onClick={() => onTemplateSelect(template.id)}
              onMouseEnter={() => setHoveredStyle(template.id)}
              onMouseLeave={() => setHoveredStyle(null)}
              className={cn(
                "relative aspect-[4/3] rounded-xl border-2 overflow-hidden transition-all hover:shadow-lg group",
                selectedTemplate === template.id
                  ? "border-[#1D4E5F] shadow-lg ring-2 ring-[#1D4E5F]/20"
                  : "border-[#E5E5E5] hover:border-[#1D4E5F]/50"
              )}
            >
              <TemplatePreview styleId={template.id} />
              
              {/* Label overlay */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-2 pt-4">
                <div className="flex items-center gap-1">
                  <span className="text-white text-xs font-medium">{template.name}</span>
                  {template.premium && (
                    <Crown className="w-3 h-3 text-amber-400" />
                  )}
                </div>
              </div>
              
              {/* Selected checkmark */}
              {selectedTemplate === template.id && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-[#1D4E5F] rounded-full flex items-center justify-center shadow-md">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              
              {/* Premium badge */}
              {template.premium && (
                <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-amber-500/90 rounded text-[10px] font-semibold text-white shadow-sm">
                  PRO
                </div>
              )}
            </button>
          ))}
        </div>
        
        {/* Hovered Style Description */}
        {hoveredStyle && SLIDE_STYLES[hoveredStyle] && (
          <div className="mt-4 p-3 bg-[#F8FAFB] rounded-xl border border-[#E5E5E5]">
            <div className="flex items-start gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex-shrink-0"
                style={{ 
                  background: `linear-gradient(135deg, ${SLIDE_STYLES[hoveredStyle].colors.primary}, ${SLIDE_STYLES[hoveredStyle].colors.secondary})` 
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#1A1A1A]">
                  {SLIDE_STYLES[hoveredStyle].displayName}
                </p>
                <p className="text-sm text-[#666666] mt-0.5">
                  {SLIDE_STYLES[hoveredStyle].description}
                </p>
                <p className="text-xs text-[#999999] mt-1">
                  Best for: {SLIDE_STYLES[hoveredStyle].bestFor}
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Selected template info (when not hovering) */}
        {!hoveredStyle && (
          <div className="mt-4 p-3 bg-[#F8FAFB] rounded-lg border border-[#E5E5E5]">
            <p className="text-xs text-[#666666]">
              <span className="font-medium text-[#1A1A1A]">Selected: </span>
              {SLIDE_STYLES[selectedTemplate as SlideStyleName]?.displayName || 'Chromatic'} style with {slideCount} slides
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
