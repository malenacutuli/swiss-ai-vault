import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface UserCredits {
  id: string;
  user_id: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

export const useUserCredits = () => {
  const { user } = useAuth();
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setCredits(null);
      setLoading(false);
      return;
    }

    const fetchCredits = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from("user_credits")
          .select("balance")
          .eq("user_id", user.id)
          .maybeSingle();

        if (fetchError) {
          console.error("Error fetching credits:", fetchError);
          setError(fetchError.message);
          setCredits(5.0); // Default for new users
        } else {
          setCredits(data?.balance ?? 5.0);
        }
      } catch (err) {
        console.error("Error in fetchCredits:", err);
        setCredits(5.0);
      } finally {
        setLoading(false);
      }
    };

    fetchCredits();

    // Subscribe to real-time changes
    const channel = supabase
      .channel("user-credits-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_credits",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("Credits updated:", payload);
          if (payload.new && typeof payload.new === "object" && "balance" in payload.new) {
            setCredits((payload.new as UserCredits).balance);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { credits, loading, error };
};
