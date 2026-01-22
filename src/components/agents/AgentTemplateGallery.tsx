import React from 'react';
import {
  Presentation,
  Search,
  FileText,
  BarChart3,
  Globe,
  Briefcase,
  Image,
  Calendar,
  Table,
  Sparkles,
  Mail,
  Bell,
  Wand2,
  PenTool
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TaskMode } from './AgentsTaskInput';

export interface AgentTemplate {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  mode: TaskMode;
  image?: string;
  gradient: string;
  category: 'productivity' | 'creative' | 'research' | 'data' | 'communication';
}

export const AGENT_TEMPLATES: AgentTemplate[] = [
  // Productivity
  {
    id: 'pitch-deck',
    title: 'Design a Pitch Deck',
    description: 'Generate a compelling pitch deck to present a new project proposal.',
    icon: Presentation,
    mode: 'slides',
    image: '/templates/pitchdeck.jpg',
    gradient: 'from-blue-500 to-purple-600',
    category: 'productivity',
  },
  {
    id: 'career-document',
    title: 'Career Document Crafter',
    description: 'Craft a compelling resume, CV, or cover letter to land your dream job.',
    icon: Briefcase,
    mode: 'default',
    image: '/templates/resume.jpg',
    gradient: 'from-slate-600 to-zinc-800',
    category: 'productivity',
  },
  {
    id: 'professional-emails',
    title: 'Craft Professional Emails',
    description: 'Your assistant for drafting formal, well-structured business and professional emails.',
    icon: Mail,
    mode: 'default',
    image: '/templates/email.jpg',
    gradient: 'from-sky-500 to-blue-600',
    category: 'communication',
  },
  {
    id: 'automated-reminders',
    title: 'Automated Reminders',
    description: 'Set up automated meeting reminders from your calendar to never miss an important event.',
    icon: Bell,
    mode: 'schedule',
    image: '/templates/reminders.jpg',
    gradient: 'from-amber-500 to-orange-600',
    category: 'productivity',
  },
  // Research
  {
    id: 'deep-research',
    title: 'Deep Research Report',
    description: 'Research any topic in depth and generate a comprehensive report with sources.',
    icon: Search,
    mode: 'research',
    image: '/templates/research.jpg',
    gradient: 'from-emerald-500 to-teal-600',
    category: 'research',
  },
  {
    id: 'market-analysis',
    title: 'Market Analysis',
    description: 'Write a comprehensive market analysis report for any industry or sector.',
    icon: FileText,
    mode: 'research',
    image: '/templates/report.jpg',
    gradient: 'from-orange-500 to-red-500',
    category: 'research',
  },
  // Data
  {
    id: 'data-analysis',
    title: 'Analyze Data',
    description: 'Upload a dataset and get insights, visualizations, and actionable recommendations.',
    icon: BarChart3,
    mode: 'visualization',
    image: '/templates/data.jpg',
    gradient: 'from-indigo-500 to-violet-600',
    category: 'data',
  },
  {
    id: 'clean-data',
    title: 'Clean Data Output',
    description: 'Clean and structure your raw data into a polished, ready-to-use format.',
    icon: Table,
    mode: 'spreadsheet',
    image: '/templates/table.jpg',
    gradient: 'from-cyan-500 to-blue-600',
    category: 'data',
  },
  {
    id: 'export-table',
    title: 'Export to Table',
    description: 'Extracts key information from documents and organizes it into a structured table.',
    icon: Table,
    mode: 'spreadsheet',
    image: '/templates/table.jpg',
    gradient: 'from-teal-500 to-emerald-600',
    category: 'data',
  },
  // Creative
  {
    id: 'custom-web-tool',
    title: 'Custom Web Tool',
    description: 'Create a specialized online tool, such as a custom calculator or converter.',
    icon: Globe,
    mode: 'website',
    image: '/templates/webtool.jpg',
    gradient: 'from-fuchsia-500 to-pink-600',
    category: 'creative',
  },
  {
    id: 'personal-website',
    title: 'Build Personal Website',
    description: 'Create a professional personal website to showcase your portfolio and brand.',
    icon: Globe,
    mode: 'website',
    image: '/templates/website.jpg',
    gradient: 'from-rose-500 to-pink-600',
    category: 'creative',
  },
  {
    id: 'ai-image-wizard',
    title: 'AI Image Wizard',
    description: 'Effortlessly edit your images by removing backgrounds, enhancing quality, and more.',
    icon: Image,
    mode: 'design',
    image: '/templates/imagewizard.jpg',
    gradient: 'from-violet-500 to-purple-600',
    category: 'creative',
  },
  {
    id: 'polish-writing',
    title: 'Polish Your Writing',
    description: 'Refine and enhance your text for better clarity, style, and impact.',
    icon: PenTool,
    mode: 'default',
    image: '/templates/writing.jpg',
    gradient: 'from-amber-500 to-yellow-500',
    category: 'creative',
  },
  {
    id: 'localize-content',
    title: 'Localize Content',
    description: 'Adapt your content for new markets with cultural and linguistic localization.',
    icon: Sparkles,
    mode: 'default',
    image: '/templates/localize.jpg',
    gradient: 'from-green-500 to-emerald-600',
    category: 'communication',
  },
];

interface AgentTemplateGalleryProps {
  templates?: AgentTemplate[];
  onSelect?: (template: AgentTemplate) => void;
  className?: string;
  title?: string;
  showCategories?: boolean;
  columns?: 2 | 3 | 4;
}

const CATEGORY_LABELS: Record<string, string> = {
  productivity: 'Productivity',
  creative: 'Creative',
  research: 'Research',
  data: 'Data',
  communication: 'Communication',
};

export function AgentTemplateGallery({
  templates = AGENT_TEMPLATES,
  onSelect,
  className,
  title = 'What are you building?',
  showCategories = false,
  columns = 2,
}: AgentTemplateGalleryProps) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  if (showCategories) {
    const categories = ['productivity', 'research', 'data', 'creative', 'communication'] as const;

    return (
      <div className={cn('max-w-5xl mx-auto space-y-8', className)}>
        {title && <h2 className="text-xl font-semibold text-gray-900">{title}</h2>}

        {categories.map(category => {
          const categoryTemplates = templates.filter(t => t.category === category);
          if (categoryTemplates.length === 0) return null;

          return (
            <div key={category}>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
                {CATEGORY_LABELS[category]}
              </h3>
              <div className={cn('grid gap-4', gridCols[columns])}>
                {categoryTemplates.map(template => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn('max-w-4xl mx-auto', className)}>
      {title && <h2 className="text-lg font-medium text-gray-900 mb-6">{title}</h2>}

      <div className={cn('grid gap-4', gridCols[columns])}>
        {templates.map(template => (
          <TemplateCard
            key={template.id}
            template={template}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

interface TemplateCardProps {
  template: AgentTemplate;
  onSelect?: (template: AgentTemplate) => void;
}

function TemplateCard({ template, onSelect }: TemplateCardProps) {
  const Icon = template.icon;

  return (
    <button
      onClick={() => onSelect?.(template)}
      className="flex items-start gap-4 p-4 border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all text-left bg-white group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-4 h-4 text-gray-500 group-hover:text-[#1D4E5F]" />
          <h3 className="font-medium text-gray-900 truncate group-hover:text-[#1D4E5F]">
            {template.title}
          </h3>
        </div>
        <p className="text-sm text-gray-500 line-clamp-2">{template.description}</p>
      </div>

      {/* Template Image/Gradient */}
      <div className={cn(
        'w-24 h-16 rounded-lg flex-shrink-0 overflow-hidden bg-gradient-to-br',
        template.gradient
      )}>
        {template.image ? (
          <img
            src={template.image}
            alt={template.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Hide broken image, show gradient background instead
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon className="w-8 h-8 text-white/60" />
          </div>
        )}
      </div>
    </button>
  );
}

export default AgentTemplateGallery;
