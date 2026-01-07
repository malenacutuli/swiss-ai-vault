import { OutputTypeCard } from './OutputTypeCard';
import {
  Mic,
  HelpCircle,
  Layers,
  GitBranch,
  Presentation,
  FileText,
  BookOpen,
  MessageCircle,
  Clock,
  Table2,
} from 'lucide-react';

interface OutputTypeGridProps {
  disabled?: boolean;
  onGenerate: (type: string) => void;
}

const OUTPUT_TYPES = [
  {
    id: 'podcast',
    title: 'Podcast',
    description: 'AI-generated audio discussion',
    icon: Mic,
  },
  {
    id: 'quiz',
    title: 'Quiz',
    description: 'Test your knowledge',
    icon: HelpCircle,
  },
  {
    id: 'flashcards',
    title: 'Flashcards',
    description: 'Study flashcards',
    icon: Layers,
  },
  {
    id: 'mindmap',
    title: 'Mind Map',
    description: 'Concept visualization',
    icon: GitBranch,
  },
  {
    id: 'slides',
    title: 'Slides',
    description: 'Presentation deck',
    icon: Presentation,
  },
  {
    id: 'report',
    title: 'Report',
    description: 'Executive summary',
    icon: FileText,
  },
  {
    id: 'study_guide',
    title: 'Study Guide',
    description: 'Structured learning guide',
    icon: BookOpen,
  },
  {
    id: 'faq',
    title: 'FAQ',
    description: 'Questions & answers',
    icon: MessageCircle,
  },
  {
    id: 'timeline',
    title: 'Timeline',
    description: 'Chronological view',
    icon: Clock,
  },
  {
    id: 'table',
    title: 'Data Table',
    description: 'Structured data extraction',
    icon: Table2,
  },
];

export function OutputTypeGrid({ disabled = false, onGenerate }: OutputTypeGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {OUTPUT_TYPES.map((type) => (
        <OutputTypeCard
          key={type.id}
          {...type}
          disabled={disabled}
          onGenerate={onGenerate}
        />
      ))}
    </div>
  );
}
