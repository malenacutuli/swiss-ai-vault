// src/components/chat/ModelSelector.tsx
import React, { useState, useEffect } from 'react';
import { ChevronDown, Zap, Shield, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  capabilities: string[];
  tier: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'inactive';
  input_price_per_1k: number;
  output_price_per_1k: number;
}

interface ModelSelectorProps {
  value?: string;
  onChange: (modelId: string) => void;
  capability?: string;
  userTier?: 'free' | 'pro' | 'enterprise';
  className?: string;
}

export function ModelSelector({
  value,
  onChange,
  capability,
  userTier = 'free',
  className
}: ModelSelectorProps) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchModels();
  }, [capability]);

  const fetchModels = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase.functions.invoke('model-registry', {
        body: { action: 'list', filters: { capability } }
      });

      if (fetchError) throw fetchError;

      // Filter active models only
      const activeModels = (data?.models || []).filter((m: ModelInfo) => m.status === 'active');
      setModels(activeModels);

      // Auto-select first available model if none selected
      if (!value && activeModels.length > 0) {
        const availableModel = activeModels.find((m: ModelInfo) => canUseModel(m, userTier));
        if (availableModel) {
          onChange(availableModel.id);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch models:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const canUseModel = (model: ModelInfo, tier: string): boolean => {
    const tierOrder = { free: 0, pro: 1, enterprise: 2 };
    return tierOrder[tier as keyof typeof tierOrder] >= tierOrder[model.tier as keyof typeof tierOrder];
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'free':
        return <Zap className="w-3 h-3" />;
      case 'pro':
        return <Shield className="w-3 h-3" />;
      case 'enterprise':
        return <Lock className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'free':
        return 'bg-green-100 text-green-700';
      case 'pro':
        return 'bg-blue-100 text-blue-700';
      case 'enterprise':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  // Group models by provider
  const modelsByProvider = models.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, ModelInfo[]>);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <div className="animate-spin w-4 h-4 border-2 border-[#1D4E5F] border-t-transparent rounded-full" />
        Loading models...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-600">
        Failed to load models: {error}
      </div>
    );
  }

  const selectedModel = models.find(m => m.id === value);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue>
            {selectedModel ? (
              <div className="flex items-center gap-2">
                <span className="font-medium">{selectedModel.name}</span>
                <Badge variant="secondary" className={cn("text-xs", getTierColor(selectedModel.tier))}>
                  {getTierIcon(selectedModel.tier)}
                  <span className="ml-1">{selectedModel.tier}</span>
                </Badge>
              </div>
            ) : (
              'Select a model'
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(modelsByProvider).map(([provider, providerModels]) => (
            <SelectGroup key={provider}>
              <SelectLabel className="font-semibold capitalize">
                {provider}
              </SelectLabel>
              {providerModels.map((model) => {
                const isAvailable = canUseModel(model, userTier);
                return (
                  <SelectItem
                    key={model.id}
                    value={model.id}
                    disabled={!isAvailable}
                    className={cn(!isAvailable && "opacity-50")}
                  >
                    <div className="flex items-center justify-between gap-3 w-full">
                      <div className="flex items-center gap-2">
                        <span className={cn(!isAvailable && "text-gray-400")}>
                          {model.name}
                        </span>
                        <Badge
                          variant="secondary"
                          className={cn("text-xs", getTierColor(model.tier))}
                        >
                          {getTierIcon(model.tier)}
                          <span className="ml-1">{model.tier}</span>
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500">
                        ${model.input_price_per_1k}/1K
                      </div>
                    </div>
                    {!isAvailable && (
                      <div className="text-xs text-gray-400 mt-1">
                        Requires {model.tier} tier
                      </div>
                    )}
                  </SelectItem>
                );
              })}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>

      {selectedModel && (
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <span>Input: ${selectedModel.input_price_per_1k}/1K tokens</span>
          <span>•</span>
          <span>Output: ${selectedModel.output_price_per_1k}/1K tokens</span>
        </div>
      )}
    </div>
  );
}
