import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useZeroRetentionMode() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["zero-retention-mode", user?.id],
    queryFn: async () => {
      if (!user) return false;

      const { data, error } = await supabase
        .from("user_settings")
        .select("zero_retention_mode")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching zero retention mode:", error);
        return false;
      }

      return data?.zero_retention_mode ?? false;
    },
    enabled: !!user,
    staleTime: 30000, // Cache for 30 seconds
  });
}
