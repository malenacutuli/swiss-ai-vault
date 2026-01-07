import React from 'react';
import {
  Headphones,
  Video,
  Network,
  FileText,
  Layers,
  HelpCircle,
  BarChart2,
  Monitor,
  Table,
} from '@/icons';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface Source {
  id: string;
  name: string;
  type: 'file' | 'url' | 'text';
}

interface StudioOutputCardsProps {
  sources: Source[];
  onGenerate: (outputType: string) => void;
}

const OUTPUT_CARDS = [
  {
    id: 'audio',
    title: 'Audio Summary',
    description: 'AI-narrated audio overview',
    icon: Headphones,
    backend: 'gemini-tts',
    output: 'MP3',
  },
  {
    id: 'video',
    title: 'Video Summary',
    description: 'Visual summary with narration',
    icon: Video,
    backend: 'veo-3.1',
    output: 'MP4',
  },
  {
    id: 'mindmap',
    title: 'Mind Map',
    description: 'Visual concept map',
    icon: Network,
    backend: 'gemini-2.5-flash',
    output: 'Mermaid SVG',
  },
  {
    id: 'report',
    title: 'Reports',
    description: 'Comprehensive written analysis',
    icon: FileText,
    backend: 'gemini-2.5-pro',
    output: 'Markdown/PDF',
  },
  {
    id: 'flashcards',
    title: 'Flashcards',
    description: 'Study cards for learning',
    icon: Layers,
    backend: 'gemini-2.5-flash',
    output: 'JSON',
  },
  {
    id: 'quiz',
    title: 'Quiz',
    description: 'Test your knowledge',
    icon: HelpCircle,
    backend: 'gemini-2.5-flash',
    output: 'JSON',
  },
  {
    id: 'infographic',
    title: 'Infographic',
    description: 'Visual data representation',
    icon: BarChart2,
    backend: 'gemini-2.5-flash',
    output: 'SVG/PNG',
  },
  {
    id: 'presentation',
    title: 'Presentation',
    description: 'Slide deck for sharing',
    icon: Monitor,
    backend: 'modal-agents',
    output: 'PPTX',
  },
  {
    id: 'table',
    title: 'Data Table',
    description: 'Structured data export',
    icon: Table,
    backend: 'gemini-2.5-flash',
    output: 'CSV/XLSX',
  },
];

export function StudioOutputCards({ sources, onGenerate }: StudioOutputCardsProps) {
  const handleCardClick = (outputType: string) => {
    if (sources.length === 0) {
      toast({
        title: 'Add sources first',
        description: 'Upload files or add URLs before generating content.',
        variant: 'destructive',
      });
      return;
    }
    onGenerate(outputType);
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      {OUTPUT_CARDS.map((card) => {
        const Icon = card.icon;
        const isDisabled = sources.length === 0;

        return (
          <button
            key={card.id}
            onClick={() => handleCardClick(card.id)}
            disabled={isDisabled}
            className={cn(
              'flex flex-col items-start p-4 rounded-lg border transition-all text-left',
              'border-gray-200 bg-white',
              isDisabled
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:border-[#1D4E5F] hover:bg-[#1D4E5F]/5 cursor-pointer',
              'group'
            )}
          >
            <Icon
              className={cn(
                'w-8 h-8 mb-2 transition-colors',
                isDisabled
                  ? 'text-gray-300'
                  : 'text-gray-400 group-hover:text-[#1D4E5F]'
              )}
            />
            <span
              className={cn(
                'text-sm font-medium transition-colors',
                isDisabled
                  ? 'text-gray-400'
                  : 'text-foreground group-hover:text-[#1D4E5F]'
              )}
            >
              {card.title}
            </span>
            <span className="text-xs text-gray-500 mt-0.5">{card.description}</span>
            <span className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">
              {card.output}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export { OUTPUT_CARDS };
