/**
 * Style presets for Studio creative components
 */

export type StylePreset = 'corporate' | 'creative' | 'academic' | 'minimal' | 'narrative';

export interface StyleConfig {
  name: string;
  description: string;
  preview: string;
  icon: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    muted: string;
  };
  mindmap: {
    central: string;
    topic: string;
    subtopic: string;
    detail: string;
    edge: { stroke: string; strokeWidth: number; animated?: boolean };
    background: string;
  };
  slides: {
    bg: string;
    accent: string;
    titleClass: string;
    subtitleClass: string;
    bulletClass: string;
    pptxColors: { bg: string; title: string; body: string; accent: string };
  };
  quiz: {
    default: string;
    selected: string;
    correct: string;
    incorrect: string;
    progressBar: string;
  };
  flashcard: {
    front: string;
    back: string;
    masteredRing: string;
    learningRing: string;
  };
  studyGuide: {
    headerBg: string;
    cardBg: string;
    accentColor: string;
    iconBg: string;
  };
}

export const stylePresets: Record<StylePreset, StyleConfig> = {
  corporate: {
    name: 'Corporate Executive',
    description: 'Clean, professional design for boardroom presentations',
    preview: 'bg-gradient-to-br from-slate-800 to-blue-900',
    icon: 'Briefcase',
    colors: {
      primary: '#1a365d',
      secondary: '#2d3748',
      accent: '#3182ce',
      background: '#f8fafc',
      text: '#1e293b',
      muted: '#64748b',
    },
    mindmap: {
      central: 'bg-slate-800 text-white border-2 border-blue-500 shadow-lg',
      topic: 'bg-white border-2 border-slate-300 text-slate-800 shadow-md',
      subtopic: 'bg-slate-50 border border-slate-200 text-slate-600',
      detail: 'bg-slate-100 border border-slate-200 text-slate-500 text-sm',
      edge: { stroke: '#475569', strokeWidth: 2 },
      background: '#f8fafc',
    },
    slides: {
      bg: 'bg-gradient-to-br from-slate-900 to-slate-800',
      accent: 'bg-blue-500',
      titleClass: 'text-white font-bold',
      subtitleClass: 'text-blue-300',
      bulletClass: 'text-gray-300',
      pptxColors: { bg: '1e293b', title: 'FFFFFF', body: 'd1d5db', accent: '3b82f6' },
    },
    quiz: {
      default: 'border-slate-200 hover:border-blue-400 hover:bg-blue-50',
      selected: 'border-blue-500 bg-blue-50',
      correct: 'border-green-500 bg-green-50',
      incorrect: 'border-red-500 bg-red-50',
      progressBar: 'bg-blue-500',
    },
    flashcard: {
      front: 'bg-gradient-to-br from-slate-800 to-blue-900 text-white',
      back: 'bg-white border-2 border-blue-500 text-slate-800',
      masteredRing: 'ring-green-400',
      learningRing: 'ring-amber-400',
    },
    studyGuide: {
      headerBg: 'bg-gradient-to-r from-slate-800 to-blue-900',
      cardBg: 'bg-white border border-slate-200',
      accentColor: 'text-blue-600',
      iconBg: 'bg-blue-100',
    },
  },
  creative: {
    name: 'Creative Studio',
    description: 'Bold gradients and dynamic visuals',
    preview: 'bg-gradient-to-br from-violet-600 to-pink-500',
    icon: 'Sparkles',
    colors: {
      primary: '#7c3aed',
      secondary: '#ec4899',
      accent: '#f59e0b',
      background: '#faf5ff',
      text: '#1f2937',
      muted: '#9ca3af',
    },
    mindmap: {
      central: 'bg-gradient-to-br from-violet-600 to-pink-500 text-white border-0 shadow-glow-creative',
      topic: 'glass-light bg-white/60 backdrop-blur-md border border-white/30 text-gray-800 shadow-lg',
      subtopic: 'bg-gradient-to-r from-amber-100 to-orange-100 border-0 text-gray-700',
      detail: 'bg-purple-50 border border-purple-100 text-purple-700 text-sm',
      edge: { stroke: '#8b5cf6', strokeWidth: 3, animated: true },
      background: '#faf5ff',
    },
    slides: {
      bg: 'bg-gradient-to-br from-violet-600 via-purple-600 to-pink-500',
      accent: 'bg-gradient-to-r from-amber-400 to-orange-500',
      titleClass: 'text-white font-black',
      subtitleClass: 'text-pink-200',
      bulletClass: 'text-white/90',
      pptxColors: { bg: '7c3aed', title: 'FFFFFF', body: 'fce7f3', accent: 'f59e0b' },
    },
    quiz: {
      default: 'border-purple-200 hover:border-purple-400 hover:bg-purple-50',
      selected: 'border-purple-500 bg-purple-50',
      correct: 'border-green-500 bg-green-50 shadow-[0_0_20px_rgba(34,197,94,0.2)]',
      incorrect: 'border-red-500 bg-red-50',
      progressBar: 'bg-gradient-to-r from-violet-500 to-pink-500',
    },
    flashcard: {
      front: 'bg-gradient-to-br from-violet-600 to-pink-500 text-white',
      back: 'glass-light bg-white/80 backdrop-blur-md border border-purple-200 text-gray-800',
      masteredRing: 'ring-amber-400',
      learningRing: 'ring-pink-400',
    },
    studyGuide: {
      headerBg: 'bg-gradient-to-r from-violet-600 to-pink-500',
      cardBg: 'glass-light bg-white/60 backdrop-blur-sm border border-white/30',
      accentColor: 'text-violet-600',
      iconBg: 'bg-gradient-to-br from-violet-100 to-pink-100',
    },
  },
  academic: {
    name: 'Academic Research',
    description: 'Scholarly design with emphasis on citations',
    preview: 'bg-gradient-to-br from-emerald-800 to-amber-700',
    icon: 'GraduationCap',
    colors: {
      primary: '#065f46',
      secondary: '#1e3a5f',
      accent: '#d97706',
      background: '#fffbeb',
      text: '#1f2937',
      muted: '#6b7280',
    },
    mindmap: {
      central: 'bg-emerald-800 text-white border-2 border-amber-500',
      topic: 'bg-amber-50 border-2 border-emerald-600 text-emerald-900',
      subtopic: 'bg-white border border-gray-300 text-gray-700',
      detail: 'bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm',
      edge: { stroke: '#065f46', strokeWidth: 1.5 },
      background: '#fffbeb',
    },
    slides: {
      bg: 'bg-gradient-to-br from-emerald-900 to-teal-800',
      accent: 'bg-amber-500',
      titleClass: 'text-white font-serif',
      subtitleClass: 'text-amber-300',
      bulletClass: 'text-emerald-100',
      pptxColors: { bg: '065f46', title: 'FFFFFF', body: 'd1fae5', accent: 'd97706' },
    },
    quiz: {
      default: 'border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50',
      selected: 'border-emerald-500 bg-emerald-50',
      correct: 'border-green-500 bg-green-50',
      incorrect: 'border-red-500 bg-red-50',
      progressBar: 'bg-emerald-600',
    },
    flashcard: {
      front: 'bg-gradient-to-br from-emerald-800 to-teal-700 text-white',
      back: 'bg-amber-50 border-2 border-emerald-600 text-emerald-900',
      masteredRing: 'ring-amber-400',
      learningRing: 'ring-emerald-400',
    },
    studyGuide: {
      headerBg: 'bg-gradient-to-r from-emerald-800 to-teal-700',
      cardBg: 'bg-amber-50 border border-amber-200',
      accentColor: 'text-emerald-700',
      iconBg: 'bg-emerald-100',
    },
  },
  minimal: {
    name: 'Minimal Modern',
    description: 'Ultra-clean design with maximum white space',
    preview: 'bg-gradient-to-br from-zinc-900 to-zinc-700',
    icon: 'Minus',
    colors: {
      primary: '#18181b',
      secondary: '#71717a',
      accent: '#f4f4f5',
      background: '#ffffff',
      text: '#18181b',
      muted: '#a1a1aa',
    },
    mindmap: {
      central: 'bg-zinc-900 text-white border-0',
      topic: 'bg-white border border-zinc-300 text-zinc-900',
      subtopic: 'bg-zinc-50 border border-zinc-200 text-zinc-600',
      detail: 'bg-zinc-100 border border-zinc-200 text-zinc-500 text-sm',
      edge: { stroke: '#18181b', strokeWidth: 1 },
      background: '#ffffff',
    },
    slides: {
      bg: 'bg-white',
      accent: 'bg-zinc-900',
      titleClass: 'text-zinc-900 font-light',
      subtitleClass: 'text-zinc-500',
      bulletClass: 'text-zinc-600',
      pptxColors: { bg: 'FFFFFF', title: '18181b', body: '52525b', accent: '18181b' },
    },
    quiz: {
      default: 'border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50',
      selected: 'border-zinc-900 bg-zinc-50',
      correct: 'border-zinc-900 bg-zinc-100',
      incorrect: 'border-red-500 bg-red-50',
      progressBar: 'bg-zinc-900',
    },
    flashcard: {
      front: 'bg-zinc-900 text-white',
      back: 'bg-white border border-zinc-300 text-zinc-900',
      masteredRing: 'ring-zinc-400',
      learningRing: 'ring-zinc-300',
    },
    studyGuide: {
      headerBg: 'bg-zinc-900',
      cardBg: 'bg-white border border-zinc-200',
      accentColor: 'text-zinc-900',
      iconBg: 'bg-zinc-100',
    },
  },
  narrative: {
    name: 'Narrative Storytelling',
    description: 'Magazine-style editorial design',
    preview: 'bg-gradient-to-br from-rose-900 to-indigo-900',
    icon: 'BookOpen',
    colors: {
      primary: '#831843',
      secondary: '#1e1b4b',
      accent: '#fbbf24',
      background: '#fef3c7',
      text: '#1f2937',
      muted: '#6b7280',
    },
    mindmap: {
      central: 'bg-gradient-to-br from-rose-800 to-indigo-900 text-white shadow-elevated',
      topic: 'bg-amber-100 border-2 border-rose-300 text-rose-900 shadow-md',
      subtopic: 'bg-white border border-indigo-200 text-indigo-800',
      detail: 'bg-rose-50 border border-rose-200 text-rose-700 text-sm',
      edge: { stroke: '#831843', strokeWidth: 2 },
      background: '#fef3c7',
    },
    slides: {
      bg: 'bg-gradient-to-br from-rose-900 via-pink-800 to-indigo-900',
      accent: 'bg-gradient-to-r from-amber-400 to-yellow-300',
      titleClass: 'text-white font-serif italic',
      subtitleClass: 'text-amber-200',
      bulletClass: 'text-rose-100',
      pptxColors: { bg: '831843', title: 'FFFFFF', body: 'fce7f3', accent: 'fbbf24' },
    },
    quiz: {
      default: 'border-rose-200 hover:border-rose-400 hover:bg-rose-50',
      selected: 'border-rose-500 bg-rose-50',
      correct: 'border-green-500 bg-green-50',
      incorrect: 'border-red-500 bg-red-50',
      progressBar: 'bg-gradient-to-r from-rose-600 to-indigo-600',
    },
    flashcard: {
      front: 'bg-gradient-to-br from-rose-800 to-indigo-900 text-white',
      back: 'bg-amber-100 border-2 border-rose-300 text-rose-900',
      masteredRing: 'ring-amber-400',
      learningRing: 'ring-rose-400',
    },
    studyGuide: {
      headerBg: 'bg-gradient-to-r from-rose-800 to-indigo-900',
      cardBg: 'bg-amber-50 border border-amber-200',
      accentColor: 'text-rose-700',
      iconBg: 'bg-amber-100',
    },
  },
};

export function getStyleConfig(style: StylePreset): StyleConfig {
  return stylePresets[style] || stylePresets.corporate;
}
