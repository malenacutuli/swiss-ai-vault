import { Presentation, Search, Mic, Radio, Globe, Smartphone, Palette, FileText, Video, Table, BarChart3, Layers } from 'lucide-react';
import type { TaskMode } from './AgentsTaskInput';

interface FeatureConfig {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const FEATURE_CONFIG: Record<TaskMode, FeatureConfig> = {
  default: {
    title: "Use Swiss Pro to create presentations",
    description: "Design pro-level slides with Swiss precision and privacy.",
    icon: Presentation,
  },
  slides: {
    title: "Swiss Slides powered by AI",
    description: "Generate beautiful presentations with Swiss design aesthetics.",
    icon: Presentation,
  },
  research: {
    title: "Swiss Research - Deep Analysis",
    description: "Run parallel research with multiple AI agents for comprehensive insights.",
    icon: Search,
  },
  audio: {
    title: "Swiss Audio Generation",
    description: "Create professional audio content with AI voice synthesis.",
    icon: Mic,
  },
  podcast: {
    title: "Swiss Podcast Studio",
    description: "Generate NotebookLM-style audio briefings and podcasts from your content.",
    icon: Radio,
  },
  website: {
    title: "Swiss Web Builder",
    description: "Create stunning websites with AI-powered design and development.",
    icon: Globe,
  },
  apps: {
    title: "Swiss Apps - Beta",
    description: "Build mobile and web applications with AI assistance.",
    icon: Smartphone,
  },
  design: {
    title: "Swiss Vision Design",
    description: "Create professional designs and visual content with AI.",
    icon: Palette,
  },
  schedule: {
    title: "Smart Scheduling",
    description: "Automate task scheduling and calendar management.",
    icon: FileText,
  },
  spreadsheet: {
    title: "Swiss Sheets",
    description: "Generate and analyze spreadsheets with AI assistance.",
    icon: Table,
  },
  visualization: {
    title: "Swiss Charts",
    description: "Create stunning data visualizations and dashboards.",
    icon: BarChart3,
  },
  video: {
    title: "Swiss Video Production",
    description: "Generate professional video content with AI.",
    icon: Video,
  },
  chat: {
    title: "Chat Mode",
    description: "Have a conversation with Swiss AI assistants.",
    icon: FileText,
  },
  playbook: {
    title: "Swiss Playbook",
    description: "Create comprehensive guides and documentation.",
    icon: FileText,
  },
  flashcards: {
    title: "Swiss Cards",
    description: "Generate flashcards for effective learning and memorization.",
    icon: Layers,
  },
  quiz: {
    title: "Swiss Quiz",
    description: "Create interactive quizzes from any content.",
    icon: FileText,
  },
  mindmap: {
    title: "Swiss Map",
    description: "Generate mind maps to visualize concepts and ideas.",
    icon: FileText,
  },
  studyguide: {
    title: "Swiss Guide",
    description: "Create comprehensive study guides from your materials.",
    icon: FileText,
  },
};

interface AgentsFeatureCardProps {
  mode: TaskMode;
}

export function AgentsFeatureCard({ mode }: AgentsFeatureCardProps) {
  const feature = FEATURE_CONFIG[mode] || FEATURE_CONFIG.default;
  const Icon = feature.icon;
  
  return (
    <div className="max-w-2xl mx-auto mt-8">
      <div className="bg-white border border-[#E5E5E5] rounded-xl p-6 flex items-center gap-6">
        <div className="flex-1">
          <h3 className="font-semibold text-[#1A1A1A]">{feature.title}</h3>
          <p className="text-sm text-[#666666] mt-1">{feature.description}</p>
        </div>
        <div className="w-16 h-16 rounded-xl bg-[#E8F4F8] border border-[#E5E5E5] flex items-center justify-center flex-shrink-0">
          <Icon className="w-8 h-8 text-[#1D4E5F]" />
        </div>
      </div>
    </div>
  );
}
