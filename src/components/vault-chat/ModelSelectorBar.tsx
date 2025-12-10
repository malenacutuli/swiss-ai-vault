import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ChevronDown, Brain, Clock } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Model {
  id: string;
  name: string;
  provider: string;
  description?: string;
  isNew?: boolean;
  isReasoning?: boolean;
  coldStart?: boolean;
}

interface ModelSelectorBarProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  className?: string;
}

// ============================================
// COMPLETE MODEL LIST - DECEMBER 2025
// ============================================

const ANTHROPIC_MODELS: Model[] = [
  { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', provider: 'Anthropic', description: 'Most intelligent', isNew: true },
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', provider: 'Anthropic', description: 'Balanced performance', isNew: true },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', provider: 'Anthropic', description: 'Fastest Claude', isNew: true },
];

const OPENAI_MODELS: Model[] = [
  { id: 'gpt-5', name: 'GPT-5', provider: 'OpenAI', description: 'Flagship unified model', isNew: true },
  { id: 'gpt-5-pro', name: 'GPT-5 Pro', provider: 'OpenAI', description: 'Extended reasoning', isNew: true, isReasoning: true },
  { id: 'gpt-5-mini', name: 'GPT-5 Mini', provider: 'OpenAI', description: 'Fast and cost-effective', isNew: true },
  { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'OpenAI', description: 'Flagship GPT-4 model', isNew: true },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'OpenAI', description: 'Fast GPT-4', isNew: true },
  { id: 'o1', name: 'OpenAI o1', provider: 'OpenAI', description: 'Advanced reasoning', isReasoning: true },
  { id: 'o1-mini', name: 'OpenAI o1-mini', provider: 'OpenAI', description: 'Fast reasoning', isReasoning: true },
];

const GOOGLE_MODELS: Model[] = [
  { id: 'gemini-3.0-pro', name: 'Gemini 3.0 Pro', provider: 'Google', description: 'Most intelligent', isNew: true },
  { id: 'gemini-3.0-flash', name: 'Gemini 3.0 Flash', provider: 'Google', description: 'Fast multimodal', isNew: true },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'Google', description: 'Previous gen' },
  { id: 'gemini-2.0-flash-thinking-exp', name: 'Gemini 2.0 Thinking', provider: 'Google', description: 'Reasoning', isReasoning: true },
];

const OPEN_SOURCE_MODELS: Model[] = [
  { id: 'Qwen/Qwen2.5-3B-Instruct', name: 'Qwen 2.5 3B', provider: 'Open Source', description: 'Fast & capable', coldStart: true },
  { id: 'Qwen/Qwen2.5-7B-Instruct', name: 'Qwen 2.5 7B', provider: 'Open Source', description: 'Balanced', coldStart: true },
  { id: 'Qwen/Qwen2.5-Coder-7B-Instruct', name: 'Qwen 2.5 Coder', provider: 'Open Source', description: 'Code specialist', coldStart: true },
  { id: 'meta-llama/Llama-3.2-3B-Instruct', name: 'Llama 3.2 3B', provider: 'Open Source', description: 'Compact', coldStart: true },
  { id: 'meta-llama/Llama-3.1-8B-Instruct', name: 'Llama 3.1 8B', provider: 'Open Source', description: 'Versatile', coldStart: true },
  { id: 'mistralai/Mistral-7B-Instruct-v0.3', name: 'Mistral 7B', provider: 'Open Source', description: 'Efficient', coldStart: true },
  { id: 'google/gemma-2-2b-it', name: 'Gemma 2 2B', provider: 'Open Source', description: 'Lightweight', coldStart: true },
  { id: 'google/gemma-2-9b-it', name: 'Gemma 2 9B', provider: 'Open Source', description: 'Powerful', coldStart: true },
  { id: 'microsoft/Phi-3.5-mini-instruct', name: 'Phi 3.5 Mini', provider: 'Open Source', description: 'Small but mighty', coldStart: true },
  { id: 'codellama/CodeLlama-7b-Instruct-hf', name: 'Code Llama 7B', provider: 'Open Source', description: 'Code generation', coldStart: true },
  { id: 'deepseek-ai/deepseek-coder-7b-instruct-v1.5', name: 'DeepSeek Coder', provider: 'Open Source', description: 'Code expert', coldStart: true },
];

const MODEL_GROUPS = [
  { name: 'Anthropic', icon: '🟣', models: ANTHROPIC_MODELS },
  { name: 'OpenAI', icon: '🟢', models: OPENAI_MODELS },
  { name: 'Google', icon: '🔵', models: GOOGLE_MODELS },
  { name: 'Open Source', icon: '🟠', models: OPEN_SOURCE_MODELS },
];

export function ModelSelectorBar({ selectedModel, onModelChange, className }: ModelSelectorBarProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Fetch user's fine-tuned models
  const { data: fineTunedModels = [] } = useQuery({
    queryKey: ['user-finetuned-models'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from('models').select('model_id, name, base_model').eq('user_id', user.id);
      return (data || []).map(m => ({
        id: m.model_id,
        name: m.name || `Fine-tuned ${m.base_model?.split('/').pop()}`,
        provider: 'Fine-tuned',
        coldStart: true,
      }));
    },
  });

  const allModelGroups = useMemo(() => {
    const groups = [...MODEL_GROUPS];
    if (fineTunedModels.length > 0) {
      groups.unshift({ name: 'Your Models', icon: '⭐', models: fineTunedModels });
    }
    return groups;
  }, [fineTunedModels]);

  const selectedModelInfo = useMemo(() => {
    for (const group of allModelGroups) {
      const found = group.models.find(m => m.id === selectedModel);
      if (found) return found;
    }
    return { id: selectedModel, name: selectedModel.split('/').pop() || selectedModel, provider: 'Unknown' };
  }, [selectedModel, allModelGroups]);

  return (
    <div className={`flex items-center gap-2 p-2 border-b border-border/50 ${className || ''}`}>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2 font-medium">
            <span className="truncate max-w-[200px]">{selectedModelInfo.name}</span>
            {selectedModelInfo.isNew && <Badge className="bg-green-500/20 text-green-400 text-xs">NEW</Badge>}
            {selectedModelInfo.isReasoning && <Brain className="h-3 w-3 text-purple-400" />}
            {selectedModelInfo.coldStart && <Clock className="h-3 w-3 text-yellow-400" />}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align="start" className="w-80 max-h-[500px] overflow-y-auto">
          {allModelGroups.map((group, idx) => (
            <React.Fragment key={group.name}>
              {idx > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="flex items-center gap-2">
                <span>{group.icon}</span>
                <span>{group.name}</span>
                <span className="text-xs text-muted-foreground">({group.models.length})</span>
              </DropdownMenuLabel>
              
              {group.models.map(model => (
                <DropdownMenuItem
                  key={model.id}
                  onClick={() => { onModelChange(model.id); setIsOpen(false); }}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{model.name}</span>
                      {model.isNew && <Badge className="bg-green-500/20 text-green-400 text-xs px-1">NEW</Badge>}
                      {model.isReasoning && <Brain className="h-3 w-3 text-purple-400" />}
                    </div>
                    {model.description && <span className="text-xs text-muted-foreground">{model.description}</span>}
                  </div>
                  {model.coldStart && <span className="text-xs text-yellow-500 flex items-center gap-1"><Clock className="h-3 w-3" /></span>}
                  {selectedModel === model.id && <span className="text-primary">✓</span>}
                </DropdownMenuItem>
              ))}
            </React.Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      
      {selectedModelInfo.coldStart && <span className="text-xs text-yellow-500">First request may take 30-60s</span>}
    </div>
  );
}

export default ModelSelectorBar;
