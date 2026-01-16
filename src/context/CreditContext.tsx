import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CreditContextType {
  balance: number;
  loading: boolean;
  refresh: () => Promise<void>;
  canAfford: (amount: number) => boolean;
}

const CreditContext = createContext<CreditContextType | null>(null);

export function CreditProvider({ children }: { children: ReactNode }) {
  const [balance, setBalance] = useState(100);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      
      const { data } = await supabase
        .from('unified_credits')
        .select('purchased_balance, grant_balance, monthly_allowance, monthly_used')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (data) {
        const monthlyRemaining = Math.max(0, (data.monthly_allowance || 0) - (data.monthly_used || 0));
        const totalBalance = monthlyRemaining + (data.purchased_balance || 0) + (data.grant_balance || 0);
        setBalance(totalBalance);
      }
    } catch (error) {
      console.error('Failed to fetch credits:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const canAfford = useCallback((amount: number) => {
    return balance >= amount;
  }, [balance]);

  useEffect(() => {
    refresh();
    
    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });

    return () => subscription.unsubscribe();
  }, [refresh]);

  return (
    <CreditContext.Provider value={{ balance, loading, refresh, canAfford }}>
      {children}
    </CreditContext.Provider>
  );
}

export const useCreditContext = () => {
  const ctx = useContext(CreditContext);
  if (!ctx) throw new Error('useCreditContext must be within CreditProvider');
  return ctx;
};
