import { useState, useEffect, useCallback } from 'react';

const ONBOARDING_KEY = 'sv_memory_onboarding_complete';
const ONBOARDING_VERSION = '1'; // Bump this to re-show onboarding after major updates

export function useMemoryOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  
  useEffect(() => {
    const stored = localStorage.getItem(ONBOARDING_KEY);
    
    if (!stored || stored !== ONBOARDING_VERSION) {
      setShowOnboarding(true);
    }
    
    setHasChecked(true);
  }, []);
  
  const completeOnboarding = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, ONBOARDING_VERSION);
    setShowOnboarding(false);
  }, []);
  
  const skipOnboarding = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, ONBOARDING_VERSION);
    setShowOnboarding(false);
  }, []);
  
  const resetOnboarding = useCallback(() => {
    localStorage.removeItem(ONBOARDING_KEY);
    setShowOnboarding(true);
  }, []);
  
  return {
    showOnboarding,
    hasChecked,
    completeOnboarding,
    skipOnboarding,
    resetOnboarding
  };
}
