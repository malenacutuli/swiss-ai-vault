import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  tier: 'free' | 'pro' | 'enterprise';
}

export interface CompareResponse {
  model: string;
  displayName: string;
  provider: string;
  response: string | null;
  error?: string;
  tokens: number;
  latency: number;
  status: 'pending' | 'streaming' | 'complete' | 'error';
  rating?: number;
}

export interface CompareResult {
  prompt: string;
  responses: CompareResponse[];
  timestamp: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  // OpenAI
  { id: 'gpt-5.2', name: 'GPT-5.2', provider: 'OpenAI', tier: 'pro' },
  { id: 'gpt-5', name: 'GPT-5', provider: 'OpenAI', tier: 'pro' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', tier: 'free' },
  { id: 'o3', name: 'o3', provider: 'OpenAI', tier: 'pro' },
  { id: 'o4-mini', name: 'o4-mini', provider: 'OpenAI', tier: 'pro' },
  // Anthropic
  { id: 'claude-4.5-opus', name: 'Claude 4.5 Opus', provider: 'Anthropic', tier: 'pro' },
  { id: 'claude-4-sonnet', name: 'Claude 4 Sonnet', provider: 'Anthropic', tier: 'pro' },
  { id: 'claude-3.5-haiku', name: 'Claude 3.5 Haiku', provider: 'Anthropic', tier: 'free' },
  // Google
  { id: 'gemini-3.0-pro', name: 'Gemini 3.0 Pro', provider: 'Google', tier: 'pro' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google', tier: 'pro' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google', tier: 'free' },
  // DeepSeek
  { id: 'deepseek-r1', name: 'DeepSeek R1', provider: 'DeepSeek', tier: 'free' },
  { id: 'deepseek-v3', name: 'DeepSeek V3', provider: 'DeepSeek', tier: 'free' },
  // xAI
  { id: 'grok-3', name: 'Grok 3', provider: 'xAI', tier: 'pro' },
  // Mistral
  { id: 'mistral-large', name: 'Mistral Large 2', provider: 'Mistral', tier: 'pro' },
  // Meta
  { id: 'llama-4', name: 'Llama 4', provider: 'Meta', tier: 'free' },
];

export const MODEL_PRESETS = {
  'frontier': ['gpt-5.2', 'claude-4.5-opus', 'gemini-3.0-pro', 'o3'],
  'fast': ['gpt-4o', 'claude-3.5-haiku', 'gemini-2.5-flash', 'deepseek-v3'],
  'code': ['claude-4-sonnet', 'deepseek-r1', 'gpt-5', 'o4-mini'],
  'free': ['gpt-4o', 'gemini-2.5-flash', 'deepseek-r1', 'llama-4'],
};

export function useCompareMode() {
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [selectedModels, setSelectedModels] = useState<string[]>(['gpt-5.2', 'claude-4-sonnet']);
  const [isComparing, setIsComparing] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const { toast } = useToast();

  const toggleCompareMode = useCallback(() => {
    setIsCompareMode(prev => !prev);
    if (isCompareMode) {
      setResult(null);
    }
  }, [isCompareMode]);

  const toggleModel = useCallback((modelId: string) => {
    setSelectedModels(prev => {
      if (prev.includes(modelId)) {
        // Don't allow fewer than 2 models
        if (prev.length <= 2) {
          toast({
            title: 'Minimum 2 models required',
            description: 'Select a different model first.',
          });
          return prev;
        }
        return prev.filter(m => m !== modelId);
      } else {
        // Don't allow more than 4 models
        if (prev.length >= 4) {
          toast({
            title: 'Maximum 4 models',
            description: 'Deselect a model first.',
          });
          return prev;
        }
        return [...prev, modelId];
      }
    });
  }, [toast]);

  const applyPreset = useCallback((presetKey: keyof typeof MODEL_PRESETS) => {
    setSelectedModels(MODEL_PRESETS[presetKey]);
  }, []);

  const compare = useCallback(async (prompt: string, systemPrompt?: string) => {
    if (selectedModels.length < 2) {
      toast({
        title: 'Select models',
        description: 'Choose at least 2 models to compare.',
        variant: 'destructive',
      });
      return null;
    }

    setIsComparing(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('ghost-compare', {
        body: {
          prompt,
          models: selectedModels,
          systemPrompt,
        },
      });

      if (error) throw error;

      setResult(data);

      toast({
        title: 'Comparison complete',
        description: `Received responses from ${data.responses.filter((r: any) => r.status === 'complete').length} models.`,
      });

      return data;

    } catch (error: any) {
      toast({
        title: 'Comparison failed',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsComparing(false);
    }
  }, [selectedModels, toast]);

  const rateResponse = useCallback((modelId: string, rating: number) => {
    setResult(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        responses: prev.responses.map(r => 
          r.model === modelId ? { ...r, rating } : r
        ),
      };
    });
  }, []);

  const clearResult = useCallback(() => {
    setResult(null);
  }, []);

  return {
    isCompareMode,
    toggleCompareMode,
    selectedModels,
    toggleModel,
    applyPreset,
    compare,
    isComparing,
    result,
    rateResponse,
    clearResult,
    availableModels: AVAILABLE_MODELS,
  };
}
