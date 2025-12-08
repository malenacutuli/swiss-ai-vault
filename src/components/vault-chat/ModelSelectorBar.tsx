import { useState, useRef, useEffect } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Lock } from 'lucide-react';

// Import model logos
import openaiLogo from '@/assets/models/openai-logo.png';
import anthropicLogo from '@/assets/models/anthropic-logo.png';
import googleLogo from '@/assets/models/google-logo.png';
import mistralLogo from '@/assets/models/mistral-logo.png';
import metaLogo from '@/assets/models/meta-logo.png';
import qwenLogo from '@/assets/models/qwen-logo.jpg';

interface Model {
  id: string;
  name: string;
  provider: string;
  isLocal?: boolean;
}

const AVAILABLE_MODELS: Model[] = [
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'Anthropic' },
  { id: 'gemini-pro', name: 'Gemini Pro', provider: 'Google' },
  { id: 'mistral-7b', name: 'Mistral 7B', provider: 'Mistral', isLocal: true },
  { id: 'llama3.2-3b', name: 'Llama 3.2 3B', provider: 'Meta', isLocal: true },
  { id: 'qwen2.5-3b', name: 'Qwen 2.5 3B', provider: 'Local', isLocal: true },
];

const PROVIDER_CONFIG = [
  { provider: 'OpenAI', logo: openaiLogo, models: ['gpt-4o', 'gpt-4o-mini'] },
  { provider: 'Anthropic', logo: anthropicLogo, models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'] },
  { provider: 'Google', logo: googleLogo, models: ['gemini-pro'] },
  { provider: 'Mistral', logo: mistralLogo, models: ['mistral-7b'] },
  { provider: 'Meta', logo: metaLogo, models: ['llama3.2-3b', 'llama3.2-1b'] },
  { provider: 'Local', logo: qwenLogo, models: ['qwen2.5-3b', 'qwen2.5-7b'] },
];

interface ModelSelectorBarProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  className?: string;
}

export function ModelSelectorBar({ selectedModel, onModelChange, className }: ModelSelectorBarProps) {
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowModelPicker(false);
        setActiveProvider(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleProviderClick = (provider: typeof PROVIDER_CONFIG[0]) => {
    const providerModels = AVAILABLE_MODELS.filter(m => provider.models.includes(m.id));
    
    if (providerModels.length === 1) {
      onModelChange(providerModels[0].id);
      setShowModelPicker(false);
      setActiveProvider(null);
    } else {
      setActiveProvider(provider.provider);
      setShowModelPicker(true);
    }
  };

  return (
    <TooltipProvider>
      <div className={cn("relative inline-flex", className)} ref={pickerRef}>
        <div className="flex items-center gap-1 p-1.5 bg-muted/50 rounded-full border border-border/50">
          {PROVIDER_CONFIG.map((provider) => {
            const isSelected = provider.models.includes(selectedModel);
            const providerModels = AVAILABLE_MODELS.filter(m => provider.models.includes(m.id));

            return (
              <Tooltip key={provider.provider}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleProviderClick(provider)}
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center transition-all overflow-hidden",
                      "hover:bg-background hover:shadow-sm",
                      isSelected && "bg-background shadow-sm ring-2 ring-primary/30"
                    )}
                  >
                    <img 
                      src={provider.logo} 
                      alt={provider.provider}
                      className="w-6 h-6 object-contain"
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-center">
                  <p className="font-medium">{provider.provider}</p>
                  {providerModels.length > 1 && (
                    <p className="text-xs text-muted-foreground">Click to select model</p>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Model picker dropdown */}
        {showModelPicker && activeProvider && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-popover border border-border rounded-lg shadow-lg p-1.5 z-50 min-w-[180px]">
            {AVAILABLE_MODELS
              .filter(m => PROVIDER_CONFIG.find(p => p.provider === activeProvider)?.models.includes(m.id))
              .map(model => (
                <button
                  key={model.id}
                  onClick={() => {
                    onModelChange(model.id);
                    setShowModelPicker(false);
                    setActiveProvider(null);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors",
                    selectedModel === model.id && "bg-muted"
                  )}
                >
                  <div className="font-medium text-sm">{model.name}</div>
                  {model.isLocal && (
                    <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 mt-0.5">
                      <Lock className="h-3 w-3" />
                      On-premises
                    </div>
                  )}
                </button>
              ))
            }
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
