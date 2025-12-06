import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FinetuningTemplate {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  language: string;
  language_code: string;
  domain: string;
  icon: string | null;
  recommended_model: string;
  recommended_method: string | null;
  default_hyperparameters: Record<string, unknown> | null;
  sample_system_prompt: string | null;
  sample_conversations: Array<{ messages: Array<{ role: string; content: string }> }> | null;
  difficulty: string | null;
  estimated_time: string | null;
  use_cases: string[] | null;
  is_active: boolean | null;
  created_at: string | null;
}

export interface TemplateSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  language: string;
  language_code: string;
  domain: string;
  icon: string | null;
  recommended_model: string;
  difficulty: string | null;
  estimated_time: string | null;
  use_cases: string[] | null;
  is_active: boolean | null;
}

export const useFinetuningTemplates = (filters?: {
  language?: string;
  domain?: string;
}) => {
  return useQuery({
    queryKey: ["finetuning-templates", filters],
    queryFn: async () => {
      let query = supabase
        .from("template_summary")
        .select("*")
        .eq("is_active", true);

      if (filters?.language && filters.language !== "all") {
        query = query.eq("language_code", filters.language);
      }

      if (filters?.domain && filters.domain !== "all") {
        query = query.eq("domain", filters.domain);
      }

      const { data, error } = await query.order("language", { ascending: true });

      if (error) throw error;
      return data as TemplateSummary[];
    },
  });
};

export const useFinetuningTemplate = (id: string | null) => {
  return useQuery({
    queryKey: ["finetuning-template", id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("finetuning_templates")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as FinetuningTemplate;
    },
    enabled: !!id,
  });
};

export const TEMPLATE_LANGUAGES = [
  { value: "all", label: "All Languages" },
  { value: "de", label: "German" },
  { value: "fr", label: "French" },
  { value: "it", label: "Italian" },
  { value: "es", label: "Spanish" },
  { value: "pt", label: "Portuguese" },
  { value: "nl", label: "Dutch" },
  { value: "de-CH", label: "Swiss German" },
];

export const TEMPLATE_DOMAINS = [
  { value: "all", label: "All Domains" },
  { value: "customer_service", label: "Customer Service" },
  { value: "finance", label: "Finance" },
  { value: "legal", label: "Legal" },
  { value: "healthcare", label: "Healthcare" },
  { value: "insurance", label: "Insurance" },
  { value: "hr", label: "Human Resources" },
  { value: "retail", label: "Retail" },
];
