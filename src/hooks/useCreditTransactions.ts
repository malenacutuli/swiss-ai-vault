import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { subDays, format, startOfDay } from "date-fns";

export interface CreditTransaction {
  id: string;
  user_id: string;
  service_type: string;
  credits_used: number;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DailyUsage {
  date: string;
  [key: string]: number | string;
}

export interface ServiceSummary {
  service_type: string;
  total_credits: number;
  color: string;
}

const SERVICE_COLORS: Record<string, string> = {
  DATA_AUGMENTATION: "hsl(180, 70%, 50%)",
  FINE_TUNING_LLM_COST: "hsl(270, 70%, 60%)",
  EVALUATION: "hsl(200, 70%, 50%)",
  INFERENCE: "hsl(140, 70%, 50%)",
  SYNTHETIC_DATA: "hsl(30, 70%, 50%)",
};

export function useCreditTransactions(days: number = 30) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["credit-transactions", user?.id, days],
    queryFn: async () => {
      if (!user) return [];
      
      const startDate = subDays(new Date(), days);
      
      const { data, error } = await supabase
        .from("credit_transactions")
        .select("*")
        .eq("user_id", user.id)
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return data as CreditTransaction[];
    },
    enabled: !!user,
  });
}

export function useDailyUsageChart(days: number = 30) {
  const { data: transactions, isLoading, error } = useCreditTransactions(days);

  // Group by date and service type
  const dailyUsage: DailyUsage[] = [];
  const serviceTypes = new Set<string>();

  if (transactions) {
    const usageMap = new Map<string, Record<string, number>>();
    
    // Initialize all days in range
    for (let i = days - 1; i >= 0; i--) {
      const date = format(subDays(new Date(), i), "MMM d");
      usageMap.set(date, {});
    }

    // Aggregate transactions
    transactions.forEach((t) => {
      const date = format(new Date(t.created_at), "MMM d");
      serviceTypes.add(t.service_type);
      
      if (!usageMap.has(date)) {
        usageMap.set(date, {});
      }
      
      const dayData = usageMap.get(date)!;
      dayData[t.service_type] = (dayData[t.service_type] || 0) + Number(t.credits_used);
    });

    // Convert to array
    usageMap.forEach((services, date) => {
      dailyUsage.push({ date, ...services });
    });
  }

  return {
    dailyUsage,
    serviceTypes: Array.from(serviceTypes),
    isLoading,
    error,
  };
}

export function useUsageSummary(days: number = 30) {
  const { data: transactions, isLoading, error } = useCreditTransactions(days);

  const summary: ServiceSummary[] = [];
  let total = 0;

  if (transactions) {
    const summaryMap = new Map<string, number>();

    transactions.forEach((t) => {
      const current = summaryMap.get(t.service_type) || 0;
      summaryMap.set(t.service_type, current + Number(t.credits_used));
      total += Number(t.credits_used);
    });

    summaryMap.forEach((credits, service) => {
      summary.push({
        service_type: service,
        total_credits: credits,
        color: SERVICE_COLORS[service] || "hsl(0, 0%, 50%)",
      });
    });

    // Sort by credits descending
    summary.sort((a, b) => b.total_credits - a.total_credits);
  }

  return {
    summary,
    total,
    isLoading,
    error,
  };
}

export { SERVICE_COLORS };
