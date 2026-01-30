import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  tier: 'free' | 'pro' | 'enterprise';
  supportsVision?: boolean;
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
  displayPrompt?: string;  // User-friendly prompt (without document text)
  attachmentSummary?: string;  // Summary of attached files for UI display
  responses: CompareResponse[];
  timestamp: string;
}

export interface CompareAttachment {
  type: 'image' | 'document' | 'text' | 'audio';
  name: string;
  base64?: string;
  text?: string;
  mimeType?: string;
}

// Vision-capable models for compare mode
export const VISION_CAPABLE_MODELS = [
  'swissvault-1.0',  // Backed by Gemini which supports vision
  'swissvault-pro',  // Backed by GPT-4o
  'swissvault-code', // Backed by GPT-4o-mini
  'swissvault-fast', // Backed by GPT-4o-mini
  'gpt-4o', 
  'gpt-4o-mini', 
  'gpt-5.2', 
  'gpt-5.2-mini',
  'gemini-3-pro', 
  'gemini-3-flash', 
  'gemini-2.5-pro', 
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite', 
  'gemini-1.5-pro',
];

export const AVAILABLE_MODELS: ModelOption[] = [
  // SwissVault (default)
  { id: 'swissvault-1.0', name: 'SwissVault 1.0', provider: 'SwissVault', tier: 'free', supportsVision: true },
  { id: 'swissvault-pro', name: 'SwissVault Pro', provider: 'SwissVault', tier: 'pro', supportsVision: true },
  { id: 'swissvault-code', name: 'SwissVault Code', provider: 'SwissVault', tier: 'free', supportsVision: true },
  { id: 'swissvault-fast', name: 'SwissVault Fast', provider: 'SwissVault', tier: 'free', supportsVision: true },
  // OpenAI
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', tier: 'pro', supportsVision: true },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', tier: 'pro', supportsVision: true },
  { id: 'o1', name: 'o1', provider: 'OpenAI', tier: 'pro', supportsVision: false },
  { id: 'o1-mini', name: 'o1 Mini', provider: 'OpenAI', tier: 'pro', supportsVision: false },
  { id: 'o3-mini', name: 'o3 Mini', provider: 'OpenAI', tier: 'pro', supportsVision: false },
  { id: 'o3', name: 'o3', provider: 'OpenAI', tier: 'pro', supportsVision: false },
  { id: 'o4-mini', name: 'o4 Mini', provider: 'OpenAI', tier: 'pro', supportsVision: false },
  { id: 'gpt-5.2', name: 'GPT-5.2', provider: 'OpenAI', tier: 'pro', supportsVision: true },
  { id: 'gpt-5.2-mini', name: 'GPT-5.2 Mini', provider: 'OpenAI', tier: 'pro', supportsVision: true },
  // Google
  { id: 'gemini-3-pro', name: 'Gemini 3 Pro', provider: 'Google', tier: 'pro', supportsVision: true },
  { id: 'gemini-3-flash', name: 'Gemini 3 Flash', provider: 'Google', tier: 'pro', supportsVision: true },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google', tier: 'pro', supportsVision: true },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google', tier: 'pro', supportsVision: true },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', provider: 'Google', tier: 'free', supportsVision: true },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google', tier: 'pro', supportsVision: true },
];

export const MODEL_PRESETS = {
  'frontier': ['gpt-5.2', 'gemini-3-pro', 'o3', 'gemini-2.5-pro'],
  'fast': ['swissvault-fast', 'gpt-4o-mini', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'],
  'code': ['swissvault-code', 'o3-mini', 'gpt-4o', 'gemini-2.5-pro'],
  'free': ['swissvault-1.0', 'swissvault-code', 'swissvault-fast', 'gemini-2.5-flash-lite'],
  // Vision-specific presets
  'vision': ['gpt-4o', 'gemini-2.5-pro', 'gpt-5.2', 'gemini-3-pro'],
  'vision-fast': ['swissvault-1.0', 'gpt-4o-mini', 'gemini-2.5-flash', 'gemini-3-flash'],
};

export function useCompareMode() {
  const [isCompareMode, setIsCompareMode] = useState(() => {
    try {
      return sessionStorage.getItem('ghost_compare_mode') === 'true';
    } catch {
      return false;
    }
  });
  const [selectedModels, setSelectedModels] = useState<string[]>(['swissvault-1.0', 'gpt-4o']);
  const [isComparing, setIsComparing] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(() => {
    try {
      const saved = sessionStorage.getItem('ghost_compare_result');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return null;
  });
  const { toast } = useToast();

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
        if (prev.length <= 2) {
          toast({
            title: 'Minimum 2 models required',
            description: 'Select a different model first.',
          });
          return prev;
        }
        return prev.filter(m => m !== modelId);
      } else {
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

  const compare = useCallback(async (
    prompt: string, 
    systemPrompt?: string,
    attachments?: CompareAttachment[]
  ) => {
    if (selectedModels.length < 2) {
      toast({
        title: 'Select models',
        description: 'Choose at least 2 models to compare.',
        variant: 'destructive',
      });
      return null;
    }

    // Determine which models to use based on attachments
    const hasImages = attachments?.some(a => a.type === 'image' && a.base64);
    
    let modelsToCompare = selectedModels;
    if (hasImages) {
      // Filter to only vision-capable models
      modelsToCompare = selectedModels.filter(m => VISION_CAPABLE_MODELS.includes(m));
      
      if (modelsToCompare.length < 2) {
        toast({
          title: 'Vision models required',
          description: 'Select at least 2 vision-capable models for image comparison.',
          variant: 'destructive',
        });
        return null;
      }
      
      // Notify user if some models were filtered out
      if (modelsToCompare.length < selectedModels.length) {
        toast({
          title: 'Models filtered for vision',
          description: `Comparing with ${modelsToCompare.length} vision-capable models (${selectedModels.length - modelsToCompare.length} skipped).`,
        });
      }
    }

    setIsComparing(true);

    // Build document context from text-based attachments (hidden from UI)
    let documentContext = '';
    const documentNames: string[] = [];
    attachments?.forEach(att => {
      if (att.text) {
        documentContext += `\n\n=== ${att.name} ===\n${att.text.slice(0, 50000)}`;
        documentNames.push(att.name);
      }
    });

    // Build the full prompt with document context (sent to models)
    const fullPrompt = documentContext 
      ? `${prompt}\n\n--- ATTACHED DOCUMENTS ---${documentContext}`
      : prompt;
    
    // Display prompt is just the user's question (shown in UI)
    const displayPrompt = prompt;
    
    // Build attachment summary for UI
    const attachmentSummary = attachments && attachments.length > 0
      ? `${attachments.length} file(s): ${attachments.map(a => a.name).join(', ')}`
      : undefined;

    // Prepare image attachments for multimodal models
    const imageAttachments = hasImages 
      ? attachments?.filter(a => a.type === 'image' && a.base64).map(a => ({
          base64: a.base64!,
          name: a.name,
          mimeType: a.mimeType || 'image/png',
        }))
      : undefined;

    // Show immediate UI state (pending cards + chronometer)
    const nowIso = new Date().toISOString();
    const placeholderResponses: CompareResponse[] = modelsToCompare.map((modelId) => {
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
      prompt: fullPrompt,
      displayPrompt,
      attachmentSummary,
      responses: placeholderResponses,
      timestamp: nowIso,
    });

    try {
      const { data, error } = await supabase.functions.invoke('ghost-compare', {
        body: {
          prompt: fullPrompt,
          models: modelsToCompare,
          systemPrompt,
          images: imageAttachments,
        },
      });

      if (error) throw error;

      setResult(data);
      
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
