/**
 * Health Vault Hook
 * Manages encrypted health data storage
 */

import { useState, useEffect, useCallback } from 'react';
import { getHealthVault, HealthVault } from '@/lib/helios/vault';
import { useAuth } from '@/contexts/AuthContext';

export function useHealthVault() {
  const [vault, setVault] = useState<HealthVault | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();

  useEffect(() => {
    if (user?.id) {
      initializeVault();
    }
  }, [user?.id]);

  const initializeVault = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      const healthVault = getHealthVault(user.id);

      // Use a derived key from user's session
      // In production, this could use biometric auth or a separate password
      const vaultPassword = `helios_${user.id}_${user.email}`;

      await healthVault.initialize(vaultPassword);

      setVault(healthVault);
      setIsInitialized(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize vault');
      console.error('Vault initialization error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, user?.email]);

  const lock = useCallback(() => {
    setVault(null);
    setIsInitialized(false);
  }, []);

  return {
    vault,
    isInitialized,
    isLoading,
    error,
    lock,
    reinitialize: initializeVault,
  };
}
