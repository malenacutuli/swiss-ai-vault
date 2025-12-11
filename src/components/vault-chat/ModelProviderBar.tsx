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
  comingSoon?: boolean;
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
      { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', description: 'Most intelligent', badge: 'NEW' },
      { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', description: 'Balanced performance', badge: 'NEW' },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', description: 'Fastest Claude', badge: 'NEW' },
    ]
  },
  {
    id: 'openai',
    name: 'OpenAI',
    logo: openaiLogo,
    models: [
      { id: 'gpt-5.2', name: 'GPT-5.2', description: 'Latest flagship model', badge: 'NEW' },
      { id: 'gpt-5.1-codex', name: 'GPT-5.1 Codex', description: 'Code specialist', badge: 'NEW' },
      { id: 'gpt-5.1', name: 'GPT-5.1', description: 'Advanced capabilities', badge: 'NEW' },
      { id: 'gpt-5', name: 'GPT-5', description: 'Flagship unified model' },
      { id: 'o1', name: 'OpenAI o1', description: 'Advanced reasoning', isReasoning: true },
      { id: 'o1-mini', name: 'OpenAI o1-mini', description: 'Fast reasoning', isReasoning: true },
    ]
  },
  {
    id: 'google',
    name: 'Google',
    logo: googleLogo,
    models: [
      { id: 'gemini-3.0-pro', name: 'Gemini 3.0 Pro', description: 'Most intelligent', badge: 'NEW' },
      { id: 'gemini-3.0-flash', name: 'Gemini 3.0 Flash', description: 'Fast multimodal', badge: 'NEW' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Previous gen' },
      { id: 'gemini-2.0-flash-thinking-exp', name: 'Gemini 2.0 Thinking', description: 'Reasoning', isReasoning: true },
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
      { id: 'deepseek-ai/deepseek-coder-7b-instruct-v1.5', name: 'DeepSeek Coder', description: 'Code expert', coldStart: true, comingSoon: true },
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
                    if (!model.comingSoon) {
                      onSelectModel(model.id);
                      setOpenProvider(null);
                    }
                  }}
                  disabled={model.comingSoon}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-left",
                    "transition-colors",
                    model.comingSoon ? "opacity-50 cursor-not-allowed" : "hover:bg-accent cursor-pointer",
                    selectedModel === model.id && !model.comingSoon && "bg-accent"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{model.name}</span>
                      {model.comingSoon ? (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium border border-border text-muted-foreground rounded shrink-0">
                          Coming Soon
                        </span>
                      ) : (
                        <>
                          <ModelStatusIndicator model={model.id} />
                          {model.badge && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-green-500/20 text-green-500 rounded shrink-0">
                              {model.badge}
                            </span>
                          )}
                          {model.isReasoning && (
                            <Brain className="w-3 h-3 text-purple-400 shrink-0" />
                          )}
                        </>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{model.description}</div>
                  </div>
                  {selectedModel === model.id && !model.comingSoon && (
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
