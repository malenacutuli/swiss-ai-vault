import { useState } from 'react';
import { 
  Monitor,
  Globe, 
  Smartphone, 
  Palette, 
  Calendar, 
  Search, 
  Table2, 
  BarChart3, 
  Video, 
  Volume2, 
  MessageSquare, 
  Book,
  ChevronDown,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export type AgentMode = 
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
  | 'playbook';

interface ModeConfig {
  id: AgentMode;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  placeholder: string;
}

// Primary modes - always visible as pills
const PRIMARY_MODES: ModeConfig[] = [
  { 
    id: 'slides', 
    label: 'Slides', 
    description: 'Create presentations',
    icon: Monitor,
    placeholder: 'Describe your presentation topic and key points...'
  },
  { 
    id: 'website', 
    label: 'Website', 
    description: 'Build web pages',
    icon: Globe,
    placeholder: 'Describe the website you want to build...'
  },
  { 
    id: 'apps', 
    label: 'Apps', 
    description: 'Develop applications',
    icon: Smartphone,
    placeholder: 'Describe the app you want to create...'
  },
  { 
    id: 'design', 
    label: 'Design', 
    description: 'Generate images',
    icon: Palette,
    placeholder: 'Describe the design or image you need...'
  },
];

// Secondary modes - in dropdown
const SECONDARY_MODES: ModeConfig[] = [
  { 
    id: 'schedule', 
    label: 'Schedule', 
    description: 'Automate tasks',
    icon: Calendar,
    placeholder: 'Describe what you want to automate or schedule...'
  },
  { 
    id: 'research', 
    label: 'Research', 
    description: 'Deep research',
    icon: Search,
    placeholder: 'What topic would you like to research in depth?'
  },
  { 
    id: 'spreadsheet', 
    label: 'Spreadsheet', 
    description: 'Create spreadsheets',
    icon: Table2,
    placeholder: 'Describe the spreadsheet or data you need...'
  },
  { 
    id: 'visualization', 
    label: 'Visualization', 
    description: 'Data charts',
    icon: BarChart3,
    placeholder: 'Describe the data visualization or chart you need...'
  },
  { 
    id: 'video', 
    label: 'Video', 
    description: 'Generate video',
    icon: Video,
    placeholder: 'Describe the video you want to create...'
  },
  { 
    id: 'audio', 
    label: 'Audio', 
    description: 'Text to speech',
    icon: Volume2,
    placeholder: 'Enter the text you want to convert to speech...'
  },
  { 
    id: 'chat', 
    label: 'Chat', 
    description: 'Chat with AI',
    icon: MessageSquare,
    placeholder: 'Start a conversation with Swiss AI...'
  },
  { 
    id: 'playbook', 
    label: 'Playbook', 
    description: 'Use templates',
    icon: Book,
    placeholder: 'Choose a template or describe your workflow...'
  },
];

// Combined for easy lookup
export const ALL_MODES: ModeConfig[] = [...PRIMARY_MODES, ...SECONDARY_MODES];

export function getModeConfig(mode: AgentMode): ModeConfig | undefined {
  return ALL_MODES.find(m => m.id === mode);
}

export function getPlaceholderForMode(mode: AgentMode): string {
  return getModeConfig(mode)?.placeholder || 'Describe what you want to accomplish...';
}

interface ModeSelectorProps {
  selectedMode: AgentMode;
  onModeChange: (mode: AgentMode) => void;
}

export function ModeSelector({ selectedMode, onModeChange }: ModeSelectorProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  // Check if selected mode is a secondary mode
  const selectedSecondaryMode = SECONDARY_MODES.find(m => m.id === selectedMode);
  
  return (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      {/* Primary mode pills */}
      {PRIMARY_MODES.map(mode => {
        const Icon = mode.icon;
        const isSelected = selectedMode === mode.id;
        
        return (
          <button
            key={mode.id}
            onClick={() => onModeChange(mode.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all border",
              isSelected 
                ? "bg-teal-50 text-teal-700 border-teal-200"
                : "bg-gray-50 text-gray-600 border-transparent hover:bg-gray-100"
            )}
          >
            <Icon className="w-4 h-4" />
            <span>{mode.label}</span>
          </button>
        );
      })}
      
      {/* More dropdown for secondary modes */}
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all border",
              selectedSecondaryMode 
                ? "bg-teal-50 text-teal-700 border-teal-200"
                : "bg-gray-50 text-gray-600 border-transparent hover:bg-gray-100"
            )}
          >
            {selectedSecondaryMode ? (
              <>
                <selectedSecondaryMode.icon className="w-4 h-4" />
                <span>{selectedSecondaryMode.label}</span>
              </>
            ) : (
              <>
                <span>More</span>
                <ChevronDown className="w-4 h-4" />
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end" 
          className="w-56 bg-white border border-gray-200 shadow-lg z-50"
        >
          {SECONDARY_MODES.map(mode => {
            const Icon = mode.icon;
            const isSelected = selectedMode === mode.id;
            
            return (
              <DropdownMenuItem
                key={mode.id}
                onClick={() => {
                  onModeChange(mode.id);
                  setDropdownOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 cursor-pointer",
                  isSelected && "bg-teal-50"
                )}
              >
                <Icon className={cn(
                  "w-4 h-4",
                  isSelected ? "text-teal-700" : "text-gray-500"
                )} />
                <div className="flex-1">
                  <p className={cn(
                    "text-sm font-medium",
                    isSelected ? "text-teal-700" : "text-gray-900"
                  )}>
                    {mode.label}
                  </p>
                  <p className="text-xs text-gray-500">{mode.description}</p>
                </div>
                {isSelected && (
                  <Check className="w-4 h-4 text-teal-700" />
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
