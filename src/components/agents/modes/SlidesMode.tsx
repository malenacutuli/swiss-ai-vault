import { 
  Rocket, 
  Brain, 
  Shield, 
  TrendingUp, 
  ArrowUpRight, 
  Upload,
  Crown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

interface Template {
  id: string;
  name: string;
  premium: boolean;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

const TEMPLATES: Template[] = [
  { id: 'swiss-classic', name: 'Swiss Classic', premium: false, colors: { primary: '#722F37', secondary: '#1A1A1A', accent: '#E5E5E5' } },
  { id: 'zurich', name: 'Zurich', premium: false, colors: { primary: '#1A365D', secondary: '#2D3748', accent: '#E2E8F0' } },
  { id: 'geneva', name: 'Geneva', premium: false, colors: { primary: '#065F46', secondary: '#1A1A1A', accent: '#D1FAE5' } },
  { id: 'alps', name: 'Alps', premium: false, colors: { primary: '#0284C7', secondary: '#0F172A', accent: '#E0F2FE' } },
  { id: 'glacier', name: 'Glacier', premium: false, colors: { primary: '#0891B2', secondary: '#164E63', accent: '#CFFAFE' } },
  { id: 'burgundy', name: 'Burgundy', premium: true, colors: { primary: '#9F1239', secondary: '#1A1A1A', accent: '#FFE4E6' } },
  { id: 'navy', name: 'Navy', premium: false, colors: { primary: '#1E3A5F', secondary: '#0F172A', accent: '#E0E7FF' } },
  { id: 'minimal', name: 'Minimal', premium: false, colors: { primary: '#1A1A1A', secondary: '#4B5563', accent: '#F9FAFB' } },
  { id: 'modern', name: 'Modern', premium: true, colors: { primary: '#7C3AED', secondary: '#1E1B4B', accent: '#EDE9FE' } },
];

const SLIDE_COUNTS = [4, 8, 12, 16, 20];

interface SlidesModeProps {
  onPromptSelect: (text: string) => void;
  onTemplateSelect: (templateId: string) => void;
  selectedTemplate: string;
  slideCount: number;
  onSlideCountChange: (count: number) => void;
}

// Template preview component (renders a mini slide preview)
function TemplatePreview({ template }: { template: Template }) {
  return (
    <div 
      className="w-full h-full flex flex-col"
      style={{ backgroundColor: template.colors.accent }}
    >
      {/* Header bar */}
      <div 
        className="h-3 w-full"
        style={{ backgroundColor: template.colors.primary }}
      />
      
      {/* Content area */}
      <div className="flex-1 p-3 flex flex-col justify-between">
        {/* Title placeholder */}
        <div className="space-y-1.5">
          <div 
            className="h-2.5 w-3/4 rounded-sm"
            style={{ backgroundColor: template.colors.primary }}
          />
          <div 
            className="h-1.5 w-1/2 rounded-sm opacity-60"
            style={{ backgroundColor: template.colors.secondary }}
          />
        </div>
        
        {/* Content placeholders */}
        <div className="space-y-1">
          <div 
            className="h-1 w-full rounded-sm opacity-40"
            style={{ backgroundColor: template.colors.secondary }}
          />
          <div 
            className="h-1 w-5/6 rounded-sm opacity-40"
            style={{ backgroundColor: template.colors.secondary }}
          />
          <div 
            className="h-1 w-4/6 rounded-sm opacity-40"
            style={{ backgroundColor: template.colors.secondary }}
          />
        </div>
        
        {/* Footer accent */}
        <div className="flex justify-end">
          <div 
            className="h-2 w-8 rounded-sm"
            style={{ backgroundColor: template.colors.primary }}
          />
        </div>
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
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Sample Prompts */}
      <section>
        <h3 className="text-sm font-medium text-[#666666] mb-4">Sample prompts</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SAMPLE_PROMPTS.map(prompt => {
            const Icon = prompt.icon;
            return (
              <button
                key={prompt.id}
                onClick={() => onPromptSelect(prompt.text)}
                className="text-left p-4 bg-white border border-[#E5E5E5] rounded-xl hover:border-[#722F37] hover:shadow-sm transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-[#FAFAF8] group-hover:bg-[#722F37]/10 transition-colors">
                    <Icon className="w-4 h-4 text-[#666666] group-hover:text-[#722F37]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-[#4A4A4A] group-hover:text-[#1A1A1A]">
                      {prompt.text}
                    </p>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-[#CCCCCC] group-hover:text-[#722F37] transition-colors" />
                </div>
              </button>
            );
          })}
        </div>
      </section>
      
      {/* Template Gallery */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-[#666666]">Choose a template</h3>
          <div className="flex items-center gap-4">
            {/* Slide count selector */}
            <select
              value={slideCount}
              onChange={(e) => onSlideCountChange(Number(e.target.value))}
              className="text-sm border border-[#E5E5E5] rounded-lg px-3 py-1.5 bg-white text-[#4A4A4A] focus:outline-none focus:ring-2 focus:ring-[#722F37]/20"
            >
              {SLIDE_COUNTS.map(count => (
                <option key={count} value={count}>{count} slides</option>
              ))}
            </select>
            
            {/* Import template */}
            <Button 
              variant="ghost" 
              size="sm"
              className="text-[#666666] hover:text-[#1A1A1A]"
            >
              <Upload className="w-4 h-4 mr-1.5" />
              Import template
            </Button>
          </div>
        </div>
        
        {/* Template Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {TEMPLATES.map(template => (
            <button
              key={template.id}
              onClick={() => onTemplateSelect(template.id)}
              className={cn(
                "relative aspect-[16/10] rounded-xl border-2 overflow-hidden transition-all hover:shadow-md",
                selectedTemplate === template.id
                  ? "border-[#722F37] shadow-lg ring-2 ring-[#722F37]/20"
                  : "border-[#E5E5E5] hover:border-[#CCCCCC]"
              )}
            >
              <TemplatePreview template={template} />
              
              {/* Label overlay */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-2 pt-6">
                <div className="flex items-center gap-1">
                  <span className="text-white text-xs font-medium">{template.name}</span>
                  {template.premium && (
                    <Crown className="w-3 h-3 text-yellow-400" />
                  )}
                </div>
              </div>
              
              {/* Selected checkmark */}
              {selectedTemplate === template.id && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-[#722F37] rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
