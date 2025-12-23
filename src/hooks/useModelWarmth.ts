import { useState, useEffect, useCallback } from 'react';

// Model groupings by inference endpoint
const SMALL_MODELS = ['qwen2.5-3b', 'llama3.2-1b', 'llama3.2-3b', 'gemma2-2b', 'qwen2.5-0.5b'];
const LARGE_MODELS = ['mistral-7b', 'qwen2.5-7b', 'llama3.1-8b', 'qwen2.5-coder-7b'];

type WarmthStatus = 'warm' | 'cold' | 'unknown' | 'checking';

interface WarmthState {
  status: Record<string, WarmthStatus>;
  lastChecked: number | null;
  isChecking: boolean;
}

interface EndpointResult {
  name: string;
  status: 'warm' | 'cold' | 'error';
  latency: number;
}

export function useModelWarmth() {
  const [state, setState] = useState<WarmthState>({
    status: {},
    lastChecked: null,
    isChecking: false,
  });

  const checkWarmth = useCallback(async () => {
    setState(prev => ({ ...prev, isChecking: true }));
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/keep-modal-warm`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to check warmth');
      }
      
      const data = await response.json();
      const newStatus: Record<string, WarmthStatus> = {};
      
      for (const endpoint of (data.endpoints || []) as EndpointResult[]) {
        // Determine warmth based on status and latency
        // If latency > 5000ms, likely experiencing cold start
        const isWarm = endpoint.status === 'warm' && endpoint.latency < 5000;
        const status: WarmthStatus = isWarm ? 'warm' : 'cold';
        
        // Map endpoint results to individual models
        if (endpoint.name === 'inference-small' || endpoint.name === 'vllm-main') {
          for (const model of SMALL_MODELS) {
            newStatus[model] = status;
          }
        }
        
        if (endpoint.name === 'inference-7b') {
          for (const model of LARGE_MODELS) {
            newStatus[model] = status;
          }
        }
      }
      
      setState({
        status: newStatus,
        lastChecked: Date.now(),
        isChecking: false,
      });
    } catch (error) {
      console.error('[useModelWarmth] Check failed:', error);
      
      // On error, mark all models as unknown
      const unknownStatus: Record<string, WarmthStatus> = {};
      [...SMALL_MODELS, ...LARGE_MODELS].forEach(model => {
        unknownStatus[model] = 'unknown';
      });
      
      setState({
        status: unknownStatus,
        lastChecked: Date.now(),
        isChecking: false,
      });
    }
  }, []);

  useEffect(() => {
    // Initial check
    checkWarmth();
    
    // Check every 2 minutes
    const interval = setInterval(checkWarmth, 2 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [checkWarmth]);

  const getModelStatus = useCallback((modelId: string): WarmthStatus => {
    // Normalize model ID (handle variations)
    const normalizedId = modelId.toLowerCase().replace(/[^a-z0-9.-]/g, '');
    
    // Check direct match first
    if (state.status[normalizedId]) {
      return state.status[normalizedId];
    }
    
    // Check if model name contains any known model
    for (const [model, status] of Object.entries(state.status)) {
      if (normalizedId.includes(model) || model.includes(normalizedId)) {
        return status;
      }
    }
    
    return 'unknown';
  }, [state.status]);

  return {
    warmthStatus: state.status,
    getModelStatus,
    lastChecked: state.lastChecked,
    isChecking: state.isChecking,
    refresh: checkWarmth,
  };
}
