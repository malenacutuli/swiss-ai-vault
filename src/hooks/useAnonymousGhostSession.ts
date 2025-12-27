import { useState, useEffect, useCallback } from 'react';

interface AnonymousUsage {
  prompts_used: number;
  images_generated: number;
  videos_generated: number;
  files_uploaded: number;
  web_searches: number;
  last_reset: string;
}

interface AnonymousLimits {
  prompts: number;
  images: number;
  videos: number;
  files: number;
  searches: number;
}

const ANONYMOUS_LIMITS: AnonymousLimits = {
  prompts: 5,
  images: 1,
  videos: 1,
  files: 2,
  searches: 2,
};

const STORAGE_KEY = 'ghost_anonymous_usage';

function getDefaultUsage(): AnonymousUsage {
  return {
    prompts_used: 0,
    images_generated: 0,
    videos_generated: 0,
    files_uploaded: 0,
    web_searches: 0,
    last_reset: new Date().toISOString().split('T')[0],
  };
}

function shouldResetUsage(lastReset: string): boolean {
  const today = new Date().toISOString().split('T')[0];
  return lastReset !== today;
}

export function useAnonymousGhostSession() {
  const [usage, setUsage] = useState<AnonymousUsage>(getDefaultUsage);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load usage from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AnonymousUsage;
        
        // Reset if it's a new day
        if (shouldResetUsage(parsed.last_reset)) {
          const fresh = getDefaultUsage();
          localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
          setUsage(fresh);
        } else {
          setUsage(parsed);
        }
      }
    } catch (error) {
      console.error('Failed to load anonymous usage:', error);
    }
    setIsLoaded(true);
  }, []);

  // Save usage to localStorage whenever it changes
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
    }
  }, [usage, isLoaded]);

  // Calculate remaining
  const remaining = {
    prompts: Math.max(0, ANONYMOUS_LIMITS.prompts - usage.prompts_used),
    images: Math.max(0, ANONYMOUS_LIMITS.images - usage.images_generated),
    videos: Math.max(0, ANONYMOUS_LIMITS.videos - usage.videos_generated),
    files: Math.max(0, ANONYMOUS_LIMITS.files - usage.files_uploaded),
    searches: Math.max(0, ANONYMOUS_LIMITS.searches - usage.web_searches),
  };

  // Check if can use feature
  const canUse = {
    prompt: remaining.prompts > 0,
    image: remaining.images > 0,
    video: remaining.videos > 0,
    file: remaining.files > 0,
    search: remaining.searches > 0,
  };

  // Increment usage
  const useFeature = useCallback((type: 'prompt' | 'image' | 'video' | 'file' | 'search'): boolean => {
    const typeToField: Record<string, keyof AnonymousUsage> = {
      prompt: 'prompts_used',
      image: 'images_generated',
      video: 'videos_generated',
      file: 'files_uploaded',
      search: 'web_searches',
    };

    const typeToLimit: Record<string, keyof AnonymousLimits> = {
      prompt: 'prompts',
      image: 'images',
      video: 'videos',
      file: 'files',
      search: 'searches',
    };

    const field = typeToField[type];
    const limitKey = typeToLimit[type];
    const currentValue = usage[field] as number;
    const limit = ANONYMOUS_LIMITS[limitKey];

    if (currentValue >= limit) {
      return false;
    }

    setUsage(prev => ({
      ...prev,
      [field]: (prev[field] as number) + 1,
    }));

    return true;
  }, [usage]);

  // Time until reset (midnight UTC)
  const getResetTime = () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return tomorrow;
  };

  // Clear all usage (for testing or user request)
  const clearUsage = useCallback(() => {
    const fresh = getDefaultUsage();
    setUsage(fresh);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  }, []);

  return {
    // Always anonymous/free tier
    tier: 'anonymous' as const,
    isPro: false,
    
    // Usage info
    usage,
    limits: ANONYMOUS_LIMITS,
    remaining,
    canUse,
    
    // Actions
    useFeature,
    clearUsage,
    
    // State
    isLoaded,
    
    // Reset info
    resetTime: getResetTime(),
  };
}
