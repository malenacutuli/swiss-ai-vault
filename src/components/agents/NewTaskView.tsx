import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Settings, 
  Mic, 
  ArrowUp, 
  Loader2,
  Link,
  Presentation,
  Search,
  FileText,
  BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AgentsModeSelector } from './AgentsModeSelector';
import type { TaskMode } from './AgentsTaskInput';

interface NewTaskViewProps {
  onSubmit: (prompt: string, mode: TaskMode) => void;
  isLoading?: boolean;
}

interface SamplePrompt {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  prompt: string;
  mode: TaskMode;
}

const SAMPLE_PROMPTS: SamplePrompt[] = [
  {
    icon: Presentation,
    title: 'Create a pitch deck',
    prompt: 'Create a 10-slide pitch deck for a Series A fundraise for my AI startup',
    mode: 'slides',
  },
  {
    icon: Search,
    title: 'Research a topic',
    prompt: 'Research the latest developments in quantum computing and summarize key findings',
    mode: 'research',
  },
  {
    icon: FileText,
    title: 'Write a report',
    prompt: 'Write a comprehensive market analysis report for the European fintech sector',
    mode: 'default',
  },
  {
    icon: BarChart3,
    title: 'Analyze data',
    prompt: 'Analyze this dataset and create visualizations showing key trends and insights',
    mode: 'visualization',
  },
];

export function NewTaskView({ onSubmit, isLoading }: NewTaskViewProps) {
  const [prompt, setPrompt] = useState('');
  const [currentMode, setCurrentMode] = useState<TaskMode>('default');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (!prompt.trim() || isLoading) return;
    onSubmit(prompt, currentMode);
    setPrompt('');
    setAttachedFiles([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSampleClick = (sample: SamplePrompt) => {
    setPrompt(sample.prompt);
    setCurrentMode(sample.mode);
    textareaRef.current?.focus();
  };

  const handleFileDrop = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    setAttachedFiles(prev => [...prev, ...fileArray].slice(0, 10));
    setIsDragging(false);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const { clientX, clientY } = e;
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFileDrop(e.dataTransfer.files);
  };

  const placeholderByMode: Record<TaskMode, string> = {
    default: 'Describe what you want to accomplish...',
    slides: 'Describe your presentation topic and goals...',
    research: 'What would you like to research?',
    website: 'Describe the website you want to build...',
    apps: 'Describe the app you want to create...',
    design: 'Describe the design you need...',
    schedule: 'What would you like to schedule?',
    spreadsheet: 'Describe the spreadsheet you need...',
    visualization: 'What data would you like to visualize?',
    video: 'Describe the video you want to create...',
    audio: 'Describe the audio you want to generate...',
    podcast: 'Describe the podcast episode topic...',
    chat: 'Start a conversation...',
    playbook: 'Describe the playbook you need...',
    flashcards: 'What topic do you want flashcards for?',
    quiz: 'What topic do you want a quiz on?',
    mindmap: 'What concept do you want to map?',
    studyguide: 'What subject do you want a study guide for?',
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Headline */}
      <h1 className="text-3xl font-semibold text-center text-[#1A1A1A] mb-8">
        What can I do for you?
      </h1>
      
      {/* Input Card */}
      <div
        className={cn(
          "relative bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden transition-all",
          isDragging && "ring-2 ring-[#1D4E5F] ring-offset-2"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drop overlay */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#1D4E5F]/5 border-2 border-dashed border-[#1D4E5F] rounded-xl flex items-center justify-center z-10 backdrop-blur-sm"
            >
              <div className="text-center">
                <p className="text-lg font-medium text-[#1D4E5F]">Drop files here</p>
                <p className="text-sm text-[#1D4E5F]/70">PDF, DOCX, XLSX, CSV, Images</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholderByMode[currentMode]}
          className="w-full p-6 text-[#1A1A1A] placeholder-[#999999] resize-none border-none focus:outline-none focus:ring-0 min-h-[200px] bg-transparent text-base leading-relaxed"
          rows={6}
        />
        
        {/* Attached files */}
        {attachedFiles.length > 0 && (
          <div className="px-6 pb-4 flex flex-wrap gap-2">
            {attachedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#F5F5F5] rounded-full text-sm group"
              >
                <span className="text-[#666666]">{file.name}</span>
                <button
                  onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== index))}
                  className="text-[#999999] hover:text-[#666666]"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}
        
        {/* Action Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#F0F0F0] bg-[#FAFAFA]">
          <div className="flex items-center gap-2">
            {/* Add button */}
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-[#666666] hover:text-[#1A1A1A] h-8 px-3"
              onClick={() => fileInputRef.current?.click()}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add
            </Button>
            
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.md,.png,.jpg,.jpeg,.json"
              className="hidden"
              onChange={(e) => e.target.files && handleFileDrop(e.target.files)}
            />
            
            {/* Link button */}
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-[#666666] hover:text-[#1A1A1A] h-8 px-3"
            >
              <Link className="w-4 h-4 mr-1.5" />
              Link
            </Button>
            
            {/* Settings button */}
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-[#666666] hover:text-[#1A1A1A] h-8 w-8 p-0"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Mic button */}
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-[#666666] hover:text-[#1A1A1A] h-8 w-8 p-0"
            >
              <Mic className="w-4 h-4" />
            </Button>
            
            {/* Submit button */}
            <Button 
              size="sm"
              onClick={handleSubmit}
              disabled={!prompt.trim() || isLoading}
              className="bg-[#1D4E5F] hover:bg-[#163d4a] text-white rounded-full h-8 w-8 p-0"
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
      
      {/* Mode Selector */}
      <div className="mt-6">
        <AgentsModeSelector 
          currentMode={currentMode} 
          onModeChange={setCurrentMode} 
        />
      </div>
      
      {/* Sample Prompts Grid */}
      <div className="mt-8 grid grid-cols-2 gap-4">
        {SAMPLE_PROMPTS.map((sample, index) => {
          const Icon = sample.icon;
          return (
            <button
              key={index}
              onClick={() => handleSampleClick(sample)}
              className="flex items-start gap-3 p-4 bg-white border border-[#E5E5E5] rounded-xl hover:border-[#1D4E5F]/30 hover:bg-[#FAFAFA] transition-all text-left group"
            >
              <div className="w-8 h-8 rounded-lg bg-[#F5F5F5] flex items-center justify-center flex-shrink-0 group-hover:bg-[#E8F4F8] transition-colors">
                <Icon className="w-4 h-4 text-[#666666] group-hover:text-[#1D4E5F]" />
              </div>
              <div>
                <p className="font-medium text-[#1A1A1A] text-sm">{sample.title}</p>
                <p className="text-xs text-[#999999] mt-0.5 line-clamp-2">{sample.prompt}</p>
              </div>
            </button>
          );
        })}
      </div>
      
      {/* Connected Tools Bar */}
      <div className="mt-8 flex items-center justify-center gap-2 text-sm text-[#999999]">
        <Settings className="w-4 h-4" />
        <span>Connect your tools to enhance Swiss Agents</span>
      </div>
    </div>
  );
}
