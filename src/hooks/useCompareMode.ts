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
  // SwissVault (default)
  { id: 'swissvault-1.0', name: 'SwissVault 1.0', provider: 'SwissVault', tier: 'free' },
  { id: 'swissvault-pro', name: 'SwissVault Pro', provider: 'SwissVault', tier: 'pro' },
  { id: 'swissvault-code', name: 'SwissVault Code', provider: 'SwissVault', tier: 'free' },
  { id: 'swissvault-fast', name: 'SwissVault Fast', provider: 'SwissVault', tier: 'free' },
  // OpenAI
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', tier: 'pro' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', tier: 'pro' },
  { id: 'o1', name: 'o1', provider: 'OpenAI', tier: 'pro' },
  { id: 'o1-mini', name: 'o1 Mini', provider: 'OpenAI', tier: 'pro' },
  { id: 'o3-mini', name: 'o3 Mini', provider: 'OpenAI', tier: 'pro' },
  { id: 'o3', name: 'o3', provider: 'OpenAI', tier: 'pro' },
  { id: 'o4-mini', name: 'o4 Mini', provider: 'OpenAI', tier: 'pro' },
  { id: 'gpt-5.2', name: 'GPT-5.2', provider: 'OpenAI', tier: 'pro' },
  { id: 'gpt-5.2-mini', name: 'GPT-5.2 Mini', provider: 'OpenAI', tier: 'pro' },
  // Google
  { id: 'gemini-3-pro', name: 'Gemini 3 Pro', provider: 'Google', tier: 'pro' },
  { id: 'gemini-3-flash', name: 'Gemini 3 Flash', provider: 'Google', tier: 'pro' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google', tier: 'pro' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google', tier: 'pro' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', provider: 'Google', tier: 'free' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'Google', tier: 'pro' },
  { id: 'gemini-2.0-pro', name: 'Gemini 2.0 Pro', provider: 'Google', tier: 'pro' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google', tier: 'pro' },
];

export const MODEL_PRESETS = {
  'frontier': ['gpt-5.2', 'gemini-3-pro', 'o3', 'gemini-2.5-pro'],
  'fast': ['swissvault-fast', 'gpt-4o-mini', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'],
  'code': ['swissvault-code', 'o3-mini', 'gpt-4o', 'gemini-2.5-pro'],
  'free': ['swissvault-1.0', 'swissvault-code', 'swissvault-fast', 'gemini-2.5-flash-lite'],
};

export function useCompareMode() {
  const [isCompareMode, setIsCompareMode] = useState(() => {
    // Restore compare mode from session storage on mount
    try {
      return sessionStorage.getItem('ghost_compare_mode') === 'true';
    } catch {
      return false;
    }
  });
  const [selectedModels, setSelectedModels] = useState<string[]>(['swissvault-1.0', 'gpt-4o']);
  const [isComparing, setIsComparing] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(() => {
    // Restore compare result from session storage on mount
    try {
      const saved = sessionStorage.getItem('ghost_compare_result');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return null;
  });
  const { toast } = useToast();

  // Persist compare mode to session storage
  const toggleCompareMode = useCallback(() => {
    setIsCompareMode(prev => {
      const next = !prev;
      try {
        if (next) {
          sessionStorage.setItem('ghost_compare_mode', 'true');
        } else {
          sessionStorage.removeItem('ghost_compare_mode');
          sessionStorage.removeItem('ghost_compare_result');
        }
      } catch {}
      return next;
    });
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

    // Show immediate UI state (pending cards + chronometer) while backend runs.
    const nowIso = new Date().toISOString();
    const placeholderResponses: CompareResponse[] = selectedModels.map((modelId) => {
      const meta = AVAILABLE_MODELS.find((m) => m.id === modelId);
      return {
        model: modelId,
        displayName: meta?.name ?? modelId,
        provider: meta?.provider ?? 'Model',
        response: null,
        tokens: 0,
        latency: 0,
        status: 'pending',
      };
    });

    setResult({
      prompt,
      responses: placeholderResponses,
      timestamp: nowIso,
    });

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
      
      // Persist result to session storage for recovery on refresh
      try {
        sessionStorage.setItem('ghost_compare_result', JSON.stringify(data));
      } catch {}

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
    try {
      sessionStorage.removeItem('ghost_compare_result');
    } catch {}
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
