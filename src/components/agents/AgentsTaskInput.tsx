import { useState, useRef } from 'react';
import { 
  Plus, 
  Settings, 
  Sparkles, 
  Presentation, 
  Search, 
  Mic, 
  Radio, 
  FileText, 
  Image, 
  Video, 
  Table, 
  BarChart, 
  BookOpen, 
  Brain, 
  HelpCircle,
  Loader2, 
  ArrowUp 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type TaskMode = 
  | 'default' 
  | 'slides' 
  | 'website' 
  | 'apps' 
  | 'design' 
  | 'schedule' 
  | 'research'
  | 'spreadsheet'
  | 'visualization'
  | 'video'
  | 'audio'
  | 'chat'
  | 'playbook'
  | 'podcast'
  | 'flashcards'
  | 'quiz'
  | 'mindmap'
  | 'studyguide';

interface TaskParams {
  model: string;
  mode: TaskMode;
}

interface AgentsTaskInputProps {
  mode: TaskMode;
  onModeChange: (mode: TaskMode) => void;
  onSubmit: (prompt: string, params: TaskParams) => void;
  isLoading?: boolean;
}

const MODE_CONFIG: Record<TaskMode, { 
  label: string; 
  icon: React.ComponentType<{ className?: string }>; 
  placeholder: string;
  color: string;
  modelSelector?: boolean;
}> = {
  default: {
    label: 'Task',
    icon: Sparkles,
    placeholder: 'Assign a task or ask anything',
    color: 'bg-[#F5F5F5] text-[#666666] border-[#E5E5E5]'
  },
  slides: {
    label: 'Swiss Slides',
    icon: Presentation,
    placeholder: 'Describe your presentation topic',
    color: 'bg-red-50 text-red-700 border-red-200',
    modelSelector: true
  },
  research: {
    label: 'Swiss Research',
    icon: Search,
    placeholder: 'Describe a complex project you want to research in parallel',
    color: 'bg-blue-50 text-blue-700 border-blue-200'
  },
  audio: {
    label: 'Swiss Audio',
    icon: Mic,
    placeholder: 'Describe the audio you want to create',
    color: 'bg-purple-50 text-purple-700 border-purple-200'
  },
  podcast: {
    label: 'Swiss Podcast',
    icon: Radio,
    placeholder: 'Describe the podcast topic (NotebookLM-style)',
    color: 'bg-orange-50 text-orange-700 border-orange-200'
  },
  website: {
    label: 'Website',
    icon: FileText,
    placeholder: 'Describe the website you want to create',
    color: 'bg-green-50 text-green-700 border-green-200'
  },
  apps: {
    label: 'Apps',
    icon: FileText,
    placeholder: 'Describe the app you want to create',
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200'
  },
  design: {
    label: 'Design',
    icon: Image,
    placeholder: 'Describe the design you want to create',
    color: 'bg-pink-50 text-pink-700 border-pink-200'
  },
  schedule: {
    label: 'Schedule',
    icon: FileText,
    placeholder: 'Describe what you want to schedule',
    color: 'bg-cyan-50 text-cyan-700 border-cyan-200'
  },
  spreadsheet: {
    label: 'Spreadsheet',
    icon: Table,
    placeholder: 'Describe the spreadsheet you want to create',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  visualization: {
    label: 'Visualization',
    icon: BarChart,
    placeholder: 'Describe the data visualization you need',
    color: 'bg-amber-50 text-amber-700 border-amber-200'
  },
  video: {
    label: 'Video',
    icon: Video,
    placeholder: 'Describe the video you want to create',
    color: 'bg-rose-50 text-rose-700 border-rose-200'
  },
  chat: {
    label: 'Chat',
    icon: FileText,
    placeholder: 'Start a conversation',
    color: 'bg-slate-50 text-slate-700 border-slate-200'
  },
  playbook: {
    label: 'Playbook',
    icon: BookOpen,
    placeholder: 'Describe the playbook you want to create',
    color: 'bg-violet-50 text-violet-700 border-violet-200'
  },
  flashcards: {
    label: 'Flashcards',
    icon: FileText,
    placeholder: 'Describe what you want to learn',
    color: 'bg-yellow-50 text-yellow-700 border-yellow-200'
  },
  quiz: {
    label: 'Quiz',
    icon: HelpCircle,
    placeholder: 'Describe the quiz topic',
    color: 'bg-teal-50 text-teal-700 border-teal-200'
  },
  mindmap: {
    label: 'Mindmap',
    icon: Brain,
    placeholder: 'Describe the mindmap topic',
    color: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200'
  },
  studyguide: {
    label: 'Study Guide',
    icon: BookOpen,
    placeholder: 'Describe what you want to study',
    color: 'bg-lime-50 text-lime-700 border-lime-200'
  }
};

export function AgentsTaskInput({ mode, onModeChange, onSubmit, isLoading }: AgentsTaskInputProps) {
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('swiss-pro');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const config = MODE_CONFIG[mode];
  const Icon = config.icon;
  
  const handleSubmit = () => {
    if (!prompt.trim() || isLoading) return;
    onSubmit(prompt, { model: selectedModel, mode });
    setPrompt('');
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };
  
  return (
    <div className="max-w-2xl mx-auto">
      {/* Heading */}
      <h1 className="text-4xl font-light text-center text-[#1A1A1A] mb-8">
        What can I do for you?
      </h1>
      
      {/* Input Card */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={config.placeholder}
          className="w-full p-4 text-[#1A1A1A] placeholder-[#999999] resize-none border-none focus:outline-none focus:ring-0 min-h-[100px] bg-transparent"
          rows={3}
        />
        
        {/* Action Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#F0F0F0] bg-[#FAFAF8]">
          <div className="flex items-center gap-2">
            {/* Add button */}
            <Button variant="ghost" size="sm" className="text-[#666666] hover:text-[#1A1A1A] h-8 w-8 p-0">
              <Plus className="w-4 h-4" />
            </Button>
            
            {/* Settings button */}
            <Button variant="ghost" size="sm" className="text-[#666666] hover:text-[#1A1A1A] h-8 w-8 p-0">
              <Settings className="w-4 h-4" />
            </Button>
            
            {/* Mode Pill */}
            <button
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                mode !== 'default' ? config.color : "bg-[#F5F5F5] text-[#666666] border-[#E5E5E5]"
              )}
              onClick={() => onModeChange('default')}
            >
              <Icon className="w-4 h-4" />
              {config.label}
            </button>
            
            {/* Model Selector (conditional) */}
            {config.modelSelector && (
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="text-sm border border-[#E5E5E5] rounded-full px-3 py-1.5 bg-white text-[#666666]"
              >
                <option value="swiss-pro">Swiss Pro</option>
                <option value="swiss-vision">Swiss Vision</option>
                <option value="swiss-audio">Swiss Audio</option>
              </select>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Mic button */}
            <Button variant="ghost" size="sm" className="text-[#666666] hover:text-[#1A1A1A] h-8 w-8 p-0">
              <Mic className="w-4 h-4" />
            </Button>
            
            {/* Submit button */}
            <Button 
              size="sm"
              onClick={handleSubmit}
              disabled={!prompt.trim() || isLoading}
              className="bg-[#1A1A1A] text-white rounded-full h-8 w-8 p-0 hover:bg-[#333333]"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowUp className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Tool Connectors */}
      <div className="flex items-center justify-center gap-2 mt-4 text-sm text-[#666666]">
        <Settings className="w-4 h-4" />
        <span>Connect your tools to SwissVault</span>
      </div>
    </div>
  );
}
