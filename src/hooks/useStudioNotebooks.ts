import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useStudioNotebooks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const notebooks = useQuery({
    queryKey: ['studio-notebooks', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('studio_notebooks')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createNotebook = useMutation({
    mutationFn: async (title: string) => {
      const { data, error } = await supabase
        .from('studio_notebooks')
        .insert({ title, user_id: user?.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['studio-notebooks'] }),
  });

  return { notebooks, createNotebook };
}
