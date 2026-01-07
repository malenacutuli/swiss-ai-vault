import { useState } from 'react';
import { 
  ChevronDown,
  Presentation, 
  Globe, 
  Smartphone, 
  Palette, 
  Calendar, 
  Search, 
  Table, 
  BarChart3, 
  Video, 
  Volume2, 
  Radio, 
  MessageSquare, 
  BookOpen, 
  Layers, 
  HelpCircle, 
  Network, 
  FileText 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { TaskMode } from './AgentsTaskInput';

interface ModeConfig {
  id: TaskMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const PRIMARY_MODES: ModeConfig[] = [
  { id: 'slides', label: 'Swiss Slides', icon: Presentation },
  { id: 'website', label: 'Swiss Web', icon: Globe },
  { id: 'apps', label: 'Swiss Apps', icon: Smartphone, badge: 'Beta' },
  { id: 'design', label: 'Swiss Vision', icon: Palette },
];

const MORE_MODES: ModeConfig[] = [
  { id: 'schedule', label: 'Schedule task', icon: Calendar },
  { id: 'research', label: 'Swiss Research', icon: Search },
  { id: 'spreadsheet', label: 'Swiss Sheets', icon: Table },
  { id: 'visualization', label: 'Swiss Charts', icon: BarChart3 },
  { id: 'video', label: 'Swiss Video', icon: Video },
  { id: 'audio', label: 'Swiss Audio', icon: Volume2 },
  { id: 'podcast', label: 'Swiss Podcast', icon: Radio },
  { id: 'chat', label: 'Chat mode', icon: MessageSquare },
  { id: 'playbook', label: 'Playbook', icon: BookOpen },
  // NotebookLM modes
  { id: 'flashcards', label: 'Swiss Cards', icon: Layers },
  { id: 'quiz', label: 'Swiss Quiz', icon: HelpCircle },
  { id: 'mindmap', label: 'Swiss Map', icon: Network },
  { id: 'studyguide', label: 'Swiss Guide', icon: FileText },
];

interface AgentsModeSelectorProps {
  currentMode: TaskMode;
  onModeChange: (mode: TaskMode) => void;
}

export function AgentsModeSelector({ currentMode, onModeChange }: AgentsModeSelectorProps) {
  const [showMore, setShowMore] = useState(false);
  
  const selectedMoreMode = MORE_MODES.find(m => m.id === currentMode);
  
  return (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      {/* Primary mode buttons */}
      {PRIMARY_MODES.map(mode => {
        const Icon = mode.icon;
        const isSelected = currentMode === mode.id;
        
        return (
          <Button
            key={mode.id}
            variant={isSelected ? "default" : "outline"}
            size="sm"
            onClick={() => onModeChange(isSelected ? 'default' : mode.id)}
            className={cn(
              "rounded-full transition-all",
              isSelected 
                ? "bg-[#1D4E5F] text-white border-[#1D4E5F] hover:bg-[#163d4a]"
                : "bg-white text-[#666666] border-[#E5E5E5] hover:border-[#1D4E5F]/30 hover:bg-[#FAFAF8]"
            )}
          >
            <Icon className="w-4 h-4 mr-1.5" />
            {mode.label}
            {mode.badge && (
              <span className="ml-1.5 text-xs bg-[#E5E5E5] text-[#666666] px-1.5 py-0.5 rounded">
                {mode.badge}
              </span>
            )}
          </Button>
        );
      })}
      
      {/* More dropdown */}
      <DropdownMenu open={showMore} onOpenChange={setShowMore}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className={cn(
              "rounded-full",
              selectedMoreMode 
                ? "bg-[#1D4E5F] text-white border-[#1D4E5F] hover:bg-[#163d4a]"
                : "bg-white text-[#666666] border-[#E5E5E5] hover:border-[#1D4E5F]/30"
            )}
          >
            {selectedMoreMode ? (
              <>
                <selectedMoreMode.icon className="w-4 h-4 mr-1.5" />
                {selectedMoreMode.label}
              </>
            ) : (
              <>
                More
                <ChevronDown className="w-4 h-4 ml-1" />
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end" 
          className="w-56 bg-white border-[#E5E5E5] shadow-lg z-50"
        >
          {MORE_MODES.map(mode => {
            const Icon = mode.icon;
            const isSelected = currentMode === mode.id;
            
            return (
              <DropdownMenuItem
                key={mode.id}
                onClick={() => {
                  onModeChange(isSelected ? 'default' : mode.id);
                  setShowMore(false);
                }}
                className={cn(
                  "cursor-pointer",
                  isSelected && "bg-[#E8F4F8] text-[#1D4E5F]"
                )}
              >
                <Icon className="w-4 h-4 mr-2" />
                {mode.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
