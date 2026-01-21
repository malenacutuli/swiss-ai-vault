import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Mic, 
  ArrowUp, 
  Loader2,
  Presentation,
  Globe,
  Code2,
  Palette,
  MoreHorizontal,
  Github,
  Smartphone,
  Sparkles,
  FileText,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TaskMode } from './AgentsTaskInput';

interface SwissBrAInHomeProps {
  onSubmit: (prompt: string, mode: TaskMode) => void;
  isLoading?: boolean;
  connectedTools?: string[];
}

interface QuickAction {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  mode: TaskMode;
  prompt?: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { icon: Presentation, label: 'Create slides', mode: 'slides' },
  { icon: Globe, label: 'Build website', mode: 'website' },
  { icon: Code2, label: 'Develop apps', mode: 'apps' },
  { icon: Palette, label: 'Design', mode: 'design' },
  { icon: MoreHorizontal, label: 'More', mode: 'default' },
];

const TOOL_ICONS = [
  { id: 'gmail', icon: '📧', name: 'Gmail' },
  { id: 'calendar', icon: '📅', name: 'Calendar' },
  { id: 'drive', icon: '📁', name: 'Drive' },
  { id: 'notion', icon: '📝', name: 'Notion' },
  { id: 'slack', icon: '💬', name: 'Slack' },
  { id: 'github', icon: Github, name: 'GitHub' },
  { id: 'figma', icon: '🎨', name: 'Figma' },
];

interface FeatureCard {
  icon: React.ComponentType<{ className?: string }> | string;
  title: string;
  description: string;
  action?: () => void;
}

const FEATURE_CARDS: FeatureCard[] = [
  {
    icon: Smartphone,
    title: 'Download app to access SwissBrAIn anytime and anywhere',
    description: '',
  },
  {
    icon: '🍌',
    title: 'Generate slides with Nano Banana Pro',
    description: '',
  },
  {
    icon: Sparkles,
    title: 'Turn your browser into an AI browser',
    description: '',
  },
];

export function SwissBrAInHome({ onSubmit, isLoading, connectedTools = [] }: SwissBrAInHomeProps) {
  const [prompt, setPrompt] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showToolConnect, setShowToolConnect] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (!prompt.trim() || isLoading) return;
    onSubmit(prompt, 'default');
    setPrompt('');
    setAttachedFiles([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleQuickAction = (action: QuickAction) => {
    if (action.prompt) {
      setPrompt(action.prompt);
    }
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

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] px-4">
      <div className="w-full max-w-3xl mx-auto">
        {/* Main Heading */}
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-5xl font-medium text-center text-[#1A1A1A] mb-10"
        >
          What can I do for you?
        </motion.h1>
        
        {/* Main Input Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={cn(
            "relative bg-white rounded-2xl border border-[#E5E5E5] shadow-lg overflow-hidden transition-all",
            isDragging && "ring-2 ring-[#D35400] ring-offset-2"
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
                className="absolute inset-0 bg-[#D35400]/5 border-2 border-dashed border-[#D35400] rounded-2xl flex items-center justify-center z-10 backdrop-blur-sm"
              >
                <div className="text-center">
                  <p className="text-lg font-medium text-[#D35400]">Drop files here</p>
                  <p className="text-sm text-[#D35400]/70">PDF, DOCX, XLSX, CSV, Images</p>
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
            placeholder="Assign a task or ask anything"
            className="w-full px-6 pt-6 pb-4 text-[#1A1A1A] placeholder-[#999999] resize-none border-none focus:outline-none focus:ring-0 min-h-[80px] bg-transparent text-lg leading-relaxed"
            rows={2}
          />
          
          {/* Attached files */}
          {attachedFiles.length > 0 && (
            <div className="px-6 pb-3 flex flex-wrap gap-2">
              {attachedFiles.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#F5F5F5] rounded-full text-sm group"
                >
                  <FileText className="w-3.5 h-3.5 text-[#666666]" />
                  <span className="text-[#666666] max-w-[150px] truncate">{file.name}</span>
                  <button
                    onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== index))}
                    className="text-[#999999] hover:text-[#666666] ml-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* Action Bar */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#F0F0F0]">
            <div className="flex items-center gap-1">
              {/* Add file button */}
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-[#666666] hover:text-[#1A1A1A] hover:bg-[#F5F5F5] h-9 w-9 p-0 rounded-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Plus className="w-5 h-5" />
              </Button>
              
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.md,.png,.jpg,.jpeg,.json"
                className="hidden"
                onChange={(e) => e.target.files && handleFileDrop(e.target.files)}
              />
              
              {/* GitHub button */}
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-[#666666] hover:text-[#1A1A1A] hover:bg-[#F5F5F5] h-9 w-9 p-0 rounded-full"
              >
                <Github className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="flex items-center gap-1">
              {/* Emoji button */}
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-[#666666] hover:text-[#1A1A1A] hover:bg-[#F5F5F5] h-9 w-9 p-0 rounded-full"
              >
                <span className="text-lg">😊</span>
              </Button>
              
              {/* Mic button */}
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-[#666666] hover:text-[#1A1A1A] hover:bg-[#F5F5F5] h-9 w-9 p-0 rounded-full"
              >
                <Mic className="w-5 h-5" />
              </Button>
              
              {/* Submit button */}
              <Button 
                size="sm"
                onClick={handleSubmit}
                disabled={!prompt.trim() || isLoading}
                className={cn(
                  "rounded-full h-9 w-9 p-0 transition-all",
                  prompt.trim() 
                    ? "bg-[#D35400] hover:bg-[#B84700] text-white" 
                    : "bg-[#E5E5E5] text-[#999999] cursor-not-allowed"
                )}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ArrowUp className="w-5 h-5" />
                )}
              </Button>
            </div>
          </div>
          
          {/* Tool Connection Row */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#F0F0F0] bg-[#FAFAFA]">
            <button 
              onClick={() => setShowToolConnect(!showToolConnect)}
              className="flex items-center gap-2 text-sm text-[#666666] hover:text-[#1A1A1A] transition-colors"
            >
              <span className="text-base">🔗</span>
              <span>Connect your tools to SwissBrAIn</span>
            </button>
            
            <div className="flex items-center gap-1">
              {TOOL_ICONS.slice(0, 6).map((tool) => (
                <button
                  key={tool.id}
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all",
                    connectedTools.includes(tool.id) 
                      ? "bg-[#D35400]/10 text-[#D35400]" 
                      : "hover:bg-[#F0F0F0] text-[#999999]"
                  )}
                  title={tool.name}
                >
                  {typeof tool.icon === 'string' ? (
                    tool.icon
                  ) : (
                    <tool.icon className="w-4 h-4" />
                  )}
                </button>
              ))}
              <button className="w-7 h-7 rounded-full flex items-center justify-center text-sm hover:bg-[#F0F0F0] text-[#999999]">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
        
        {/* Quick Actions */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-center gap-3 mt-6"
        >
          {QUICK_ACTIONS.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={index}
                onClick={() => handleQuickAction(action)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#E5E5E5] rounded-full hover:border-[#D35400]/30 hover:bg-[#FDF8F5] transition-all text-sm font-medium text-[#666666] hover:text-[#D35400]"
              >
                <Icon className="w-4 h-4" />
                <span>{action.label}</span>
              </button>
            );
          })}
        </motion.div>
        
        {/* Feature Cards */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-3 gap-4 mt-16"
        >
          {FEATURE_CARDS.map((card, index) => {
            const Icon = card.icon;
            return (
              <button
                key={index}
                className="flex flex-col items-start p-5 bg-white border border-[#E5E5E5] rounded-xl hover:border-[#D35400]/30 hover:shadow-md transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-lg bg-[#F5F5F5] flex items-center justify-center mb-4 group-hover:bg-[#FDF8F5] transition-colors">
                  {typeof Icon === 'string' ? (
                    <span className="text-xl">{Icon}</span>
                  ) : (
                    <Icon className="w-5 h-5 text-[#666666] group-hover:text-[#D35400]" />
                  )}
                </div>
                <p className="text-sm text-[#666666] group-hover:text-[#1A1A1A] leading-relaxed">
                  {card.title}
                </p>
              </button>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
