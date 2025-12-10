import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, Brain } from 'lucide-react';
import { ModelStatusIndicator } from './ModelStatusIndicator';

// Import provider logos
import anthropicLogo from '@/assets/models/anthropic-logo.png';
import openaiLogo from '@/assets/models/openai-logo.png';
import googleLogo from '@/assets/models/google-logo.jpg';
import metaLogo from '@/assets/models/meta-logo.png';
import mistralLogo from '@/assets/models/mistral-logo.png';
import deepseekLogo from '@/assets/models/deepseek-logo.png';
import qwenLogo from '@/assets/models/qwen-logo.jpg';

interface Model {
  id: string;
  name: string;
  description: string;
  badge?: string;
  isReasoning?: boolean;
  coldStart?: boolean;
}

interface Provider {
  id: string;
  name: string;
  logo: string;
  models: Model[];
}

const providers: Provider[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    logo: anthropicLogo,
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Latest balanced', badge: 'NEW' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fast & efficient' },
    ]
  },
  {
    id: 'openai',
    name: 'OpenAI',
    logo: openaiLogo,
    models: [
      { id: 'o1', name: 'o1', description: 'Advanced reasoning', badge: 'NEW', isReasoning: true },
      { id: 'o1-mini', name: 'o1 Mini', description: 'Fast reasoning', isReasoning: true },
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Multimodal flagship' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Cost-effective' },
    ]
  },
  {
    id: 'google',
    name: 'Google',
    logo: googleLogo,
    models: [
      { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', description: 'Latest', badge: 'NEW' },
      { id: 'gemini-2.0-flash-thinking-exp', name: 'Gemini 2.0 Thinking', description: 'Reasoning', badge: 'NEW', isReasoning: true },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: '1M context' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Fast' },
    ]
  },
  {
    id: 'meta',
    name: 'Meta',
    logo: metaLogo,
    models: [
      { id: 'meta-llama/Llama-3.2-3B-Instruct', name: 'Llama 3.2 3B', description: 'Compact', coldStart: true },
      { id: 'meta-llama/Llama-3.1-8B-Instruct', name: 'Llama 3.1 8B', description: 'Versatile', coldStart: true },
    ]
  },
  {
    id: 'mistral',
    name: 'Mistral',
    logo: mistralLogo,
    models: [
      { id: 'mistralai/Mistral-7B-Instruct-v0.3', name: 'Mistral 7B', description: 'Efficient', coldStart: true },
    ]
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    logo: deepseekLogo,
    models: [
      { id: 'deepseek-ai/deepseek-coder-7b-instruct-v1.5', name: 'DeepSeek Coder', description: 'Code expert', coldStart: true },
    ]
  },
  {
    id: 'qwen',
    name: 'Qwen',
    logo: qwenLogo,
    models: [
      { id: 'Qwen/Qwen2.5-3B-Instruct', name: 'Qwen 2.5 3B', description: 'Fast & capable', coldStart: true },
      { id: 'Qwen/Qwen2.5-7B-Instruct', name: 'Qwen 2.5 7B', description: 'Balanced', coldStart: true },
      { id: 'Qwen/Qwen2.5-Coder-7B-Instruct', name: 'Qwen 2.5 Coder', description: 'Code specialist', coldStart: true },
    ]
  },
];

interface ModelProviderBarProps {
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  className?: string;
}

export function ModelProviderBar({ 
  selectedModel, 
  onSelectModel,
  className
}: ModelProviderBarProps) {
  const [openProvider, setOpenProvider] = useState<string | null>(null);
  
  // Find which provider the selected model belongs to
  const selectedProvider = providers.find(p => 
    p.models.some(m => m.id === selectedModel)
  );
  
  const selectedModelInfo = providers
    .flatMap(p => p.models)
    .find(m => m.id === selectedModel);
  
  return (
    <div className={cn(
      "flex items-center gap-1 p-2 bg-card/50 rounded-full border border-border/50 backdrop-blur-sm",
      className
    )}>
      {providers.map((provider) => (
        <Popover 
          key={provider.id} 
          open={openProvider === provider.id}
          onOpenChange={(open) => setOpenProvider(open ? provider.id : null)}
        >
          <PopoverTrigger asChild>
            <button
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-all overflow-hidden",
                "hover:bg-accent hover:scale-110",
                selectedProvider?.id === provider.id && "ring-2 ring-primary ring-offset-2 ring-offset-background"
              )}
              title={provider.name}
            >
              <img 
                src={provider.logo} 
                alt={provider.name}
                className="w-6 h-6 object-contain rounded-full"
              />
            </button>
          </PopoverTrigger>
          
          <PopoverContent className="w-72 p-2" align="center">
            <div className="flex items-center gap-2 px-2 mb-2">
              <img src={provider.logo} alt={provider.name} className="w-5 h-5 rounded-full" />
              <span className="text-sm font-medium">{provider.name}</span>
              <span className="text-xs text-muted-foreground">({provider.models.length})</span>
            </div>
            <div className="space-y-1">
              {provider.models.map((model) => (
                <button
                  key={model.id}
                  onClick={() => {
                    onSelectModel(model.id);
                    setOpenProvider(null);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-left",
                    "hover:bg-accent transition-colors",
                    selectedModel === model.id && "bg-accent"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{model.name}</span>
                      <ModelStatusIndicator model={model.id} />
                      {model.badge && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-green-500/20 text-green-500 rounded shrink-0">
                          {model.badge}
                        </span>
                      )}
                      {model.isReasoning && (
                        <Brain className="w-3 h-3 text-purple-400 shrink-0" />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{model.description}</div>
                  </div>
                  {selectedModel === model.id && (
                    <Check className="w-4 h-4 text-primary shrink-0 ml-2" />
                  )}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ))}
    </div>
  );
}

export default ModelProviderBar;
