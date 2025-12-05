import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Trace {
  id: string;
  user_id: string | null;
  project_id: string | null;
  model_id: string;
  api_key_id: string | null;
  request: Record<string, unknown>;
  response: Record<string, unknown> | null;
  latency_ms: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  status_code: number | null;
  error_message: string | null;
  created_at: string;
}

export function useTraces(modelFilter?: string, page: number = 1, pageSize: number = 20) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["traces", user?.id, modelFilter, page, pageSize],
    queryFn: async () => {
      if (!user) return { data: [], count: 0 };

      let query = supabase
        .from("traces")
        .select("*", { count: "exact" })
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (modelFilter) {
        query = query.eq("model_id", modelFilter);
      }

      const { data, error, count } = await query;

      if (error) throw error;
      return { data: data as Trace[], count: count || 0 };
    },
    enabled: !!user,
  });
}

export function useTraceModels() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["trace-models", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("traces")
        .select("model_id")
        .eq("user_id", user.id);

      if (error) throw error;
      
      // Get unique model IDs
      const uniqueModels = [...new Set(data.map((t) => t.model_id))];
      return uniqueModels;
    },
    enabled: !!user,
  });
}
