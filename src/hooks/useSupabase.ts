import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type Tables = Database['public']['Tables'];
type Project = Tables['projects']['Row'];
type Dataset = Tables['datasets']['Row'];
type DatasetSnapshot = Tables['dataset_snapshots']['Row'];
type FinetuningJob = Tables['finetuning_jobs']['Row'];
type Experiment = Tables['experiments']['Row'];
type Evaluation = Tables['evaluations']['Row'];
type Metric = Tables['metrics']['Row'];
type Model = Tables['models']['Row'];
type ApiKey = Tables['api_keys']['Row'];

// ============================================
// PROJECT HOOKS
// ============================================

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchProjects = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setProjects(data || []);
      setError(null);
    } catch (err) {
      const error = err as Error;
      setError(error);
      toast({
        title: 'Error fetching projects',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return { projects, loading, error, refetch: fetchProjects };
}

export function useProject(id: string | undefined) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const fetchProject = useCallback(async () => {
    if (!id) {
      setProject(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      setProject(data);
      setError(null);
    } catch (err) {
      const error = err as Error;
      setError(error);
      toast({
        title: 'Error fetching project',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  return { project, loading, error, refetch: fetchProject };
}

export function useCreateProject() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const createProject = async (name: string, description?: string) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to create a project',
        variant: 'destructive',
      });
      return null;
    }

    try {
      setLoading(true);
      const { data, error: createError } = await supabase
        .from('projects')
        .insert({
          name,
          description,
          user_id: user.id,
        })
        .select()
        .single();

      if (createError) throw createError;

      toast({
        title: 'Project created',
        description: `"${name}" has been created successfully`,
      });

      return data;
    } catch (err) {
      const error = err as Error;
      setError(error);
      toast({
        title: 'Error creating project',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { createProject, loading, error };
}

export function useUpdateProject() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const updateProject = async (id: string, updates: Partial<Tables['projects']['Update']>) => {
    try {
      setLoading(true);
      const { data, error: updateError } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      toast({
        title: 'Project updated',
        description: 'Changes saved successfully',
      });

      return data;
    } catch (err) {
      const error = err as Error;
      setError(error);
      toast({
        title: 'Error updating project',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { updateProject, loading, error };
}

export function useDeleteProject() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const deleteProject = async (id: string) => {
    try {
      setLoading(true);
      const { error: deleteError } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      toast({
        title: 'Project deleted',
        description: 'Project has been removed',
      });

      return true;
    } catch (err) {
      const error = err as Error;
      setError(error);
      toast({
        title: 'Error deleting project',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { deleteProject, loading, error };
}

// ============================================
// DATASET HOOKS
// ============================================

export function useDatasets(projectId?: string) {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchDatasets = useCallback(async () => {
    if (!user) {
      setDatasets([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let query = supabase
        .from('datasets')
        .select('*')
        .order('created_at', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setDatasets(data || []);
      setError(null);
    } catch (err) {
      const error = err as Error;
      setError(error);
      toast({
        title: 'Error fetching datasets',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, projectId, toast]);

  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  return { datasets, loading, error, refetch: fetchDatasets };
}

export function useDataset(id: string | undefined) {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [snapshots, setSnapshots] = useState<DatasetSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const fetchDataset = useCallback(async () => {
    if (!id) {
      setDataset(null);
      setSnapshots([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [datasetRes, snapshotsRes] = await Promise.all([
        supabase.from('datasets').select('*').eq('id', id).maybeSingle(),
        supabase.from('dataset_snapshots').select('*').eq('dataset_id', id).order('version', { ascending: false }),
      ]);

      if (datasetRes.error) throw datasetRes.error;
      if (snapshotsRes.error) throw snapshotsRes.error;

      setDataset(datasetRes.data);
      setSnapshots(snapshotsRes.data || []);
      setError(null);
    } catch (err) {
      const error = err as Error;
      setError(error);
      toast({
        title: 'Error fetching dataset',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    fetchDataset();
  }, [fetchDataset]);

  return { dataset, snapshots, loading, error, refetch: fetchDataset };
}

export function useCreateDataset() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const createDataset = async (
    name: string,
    projectId: string | null,
    sourceType: Database['public']['Enums']['dataset_source_type'],
    config?: Record<string, unknown>
  ) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to create a dataset',
        variant: 'destructive',
      });
      return null;
    }

    try {
      setLoading(true);
      const insertData: Tables['datasets']['Insert'] = {
        name,
        project_id: projectId,
        source_type: sourceType,
        source_config: (config || {}) as Database['public']['Tables']['datasets']['Insert']['source_config'],
        user_id: user.id,
      };
      const { data, error: createError } = await supabase
        .from('datasets')
        .insert(insertData)
        .select()
        .single();

      if (createError) throw createError;

      toast({
        title: 'Dataset created',
        description: `"${name}" has been created successfully`,
      });

      return data;
    } catch (err) {
      const error = err as Error;
      setError(error);
      toast({
        title: 'Error creating dataset',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { createDataset, loading, error };
}

// ============================================
// FINETUNING JOB HOOKS
// ============================================

export function useFinetuningJobs(projectId?: string) {
  const [jobs, setJobs] = useState<FinetuningJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchJobs = useCallback(async () => {
    if (!user) {
      setJobs([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let query = supabase
        .from('finetuning_jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setJobs(data || []);
      setError(null);
    } catch (err) {
      const error = err as Error;
      setError(error);
      toast({
        title: 'Error fetching jobs',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, projectId, toast]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Real-time subscription for status changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('finetuning-jobs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'finetuning_jobs',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setJobs((prev) => [payload.new as FinetuningJob, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setJobs((prev) =>
              prev.map((job) =>
                job.id === (payload.new as FinetuningJob).id ? (payload.new as FinetuningJob) : job
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setJobs((prev) => prev.filter((job) => job.id !== (payload.old as FinetuningJob).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { jobs, loading, error, refetch: fetchJobs };
}

export function useFinetuningJob(id: string | undefined) {
  const [job, setJob] = useState<FinetuningJob | null>(null);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const fetchJob = useCallback(async () => {
    if (!id) {
      setJob(null);
      setExperiments([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [jobRes, experimentsRes] = await Promise.all([
        supabase.from('finetuning_jobs').select('*').eq('id', id).maybeSingle(),
        supabase.from('experiments').select('*').eq('job_id', id).order('created_at', { ascending: false }),
      ]);

      if (jobRes.error) throw jobRes.error;
      if (experimentsRes.error) throw experimentsRes.error;

      setJob(jobRes.data);
      setExperiments(experimentsRes.data || []);
      setError(null);
    } catch (err) {
      const error = err as Error;
      setError(error);
      toast({
        title: 'Error fetching job',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  // Real-time subscription for job updates
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`job-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'finetuning_jobs',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          setJob(payload.new as FinetuningJob);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  return { job, experiments, loading, error, refetch: fetchJob };
}

export function useCreateFinetuningJob() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const createJob = async (
    name: string,
    snapshotId: string,
    baseModel: string,
    method: Database['public']['Enums']['finetuning_method'],
    hyperparameters: Record<string, unknown>,
    projectId?: string
  ) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to create a job',
        variant: 'destructive',
      });
      return null;
    }

    try {
      setLoading(true);
      const insertData: Tables['finetuning_jobs']['Insert'] = {
        name,
        snapshot_id: snapshotId,
        base_model: baseModel,
        method,
        hyperparameters: hyperparameters as Database['public']['Tables']['finetuning_jobs']['Insert']['hyperparameters'],
        project_id: projectId,
        user_id: user.id,
      };
      const { data, error: createError } = await supabase
        .from('finetuning_jobs')
        .insert(insertData)
        .select()
        .single();

      if (createError) throw createError;

      toast({
        title: 'Fine-tuning job created',
        description: `"${name}" has been queued`,
      });

      return data;
    } catch (err) {
      const error = err as Error;
      setError(error);
      toast({
        title: 'Error creating job',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { createJob, loading, error };
}

// ============================================
// EVALUATION HOOKS
// ============================================

export function useEvaluations(projectId?: string) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchEvaluations = useCallback(async () => {
    if (!user) {
      setEvaluations([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let query = supabase
        .from('evaluations')
        .select('*')
        .order('created_at', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setEvaluations(data || []);
      setError(null);
    } catch (err) {
      const error = err as Error;
      setError(error);
      toast({
        title: 'Error fetching evaluations',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, projectId, toast]);

  useEffect(() => {
    fetchEvaluations();
  }, [fetchEvaluations]);

  return { evaluations, loading, error, refetch: fetchEvaluations };
}

// ============================================
// METRICS HOOKS
// ============================================

export function useMetrics() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchMetrics = useCallback(async () => {
    if (!user) {
      setMetrics([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('metrics')
        .select('*')
        .order('is_builtin', { ascending: false })
        .order('name', { ascending: true });

      if (fetchError) throw fetchError;
      setMetrics(data || []);
      setError(null);
    } catch (err) {
      const error = err as Error;
      setError(error);
      toast({
        title: 'Error fetching metrics',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return { metrics, loading, error, refetch: fetchMetrics };
}

export function useCreateMetric() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const createMetric = async (
    name: string,
    description: string,
    rules: { should: string[]; should_not: string[] },
    projectId?: string
  ) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to create a metric',
        variant: 'destructive',
      });
      return null;
    }

    try {
      setLoading(true);
      const { data, error: createError } = await supabase
        .from('metrics')
        .insert({
          name,
          description,
          rules,
          project_id: projectId,
          user_id: user.id,
          is_builtin: false,
        })
        .select()
        .single();

      if (createError) throw createError;

      toast({
        title: 'Metric created',
        description: `"${name}" has been created`,
      });

      return data;
    } catch (err) {
      const error = err as Error;
      setError(error);
      toast({
        title: 'Error creating metric',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { createMetric, loading, error };
}

// ============================================
// MODELS HOOKS
// ============================================

export function useModels(projectId?: string) {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchModels = useCallback(async () => {
    if (!user) {
      setModels([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('models')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setModels(data || []);
      setError(null);
    } catch (err) {
      const error = err as Error;
      setError(error);
      toast({
        title: 'Error fetching models',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  return { models, loading, error, refetch: fetchModels };
}

// ============================================
// API KEYS HOOKS
// ============================================

export function useApiKeys() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchApiKeys = useCallback(async () => {
    if (!user) {
      setApiKeys([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('api_keys')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setApiKeys(data || []);
      setError(null);
    } catch (err) {
      const error = err as Error;
      setError(error);
      toast({
        title: 'Error fetching API keys',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  return { apiKeys, loading, error, refetch: fetchApiKeys };
}

export function useCreateApiKey() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const createApiKey = async (name: string) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to create an API key',
        variant: 'destructive',
      });
      return null;
    }

    try {
      setLoading(true);

      // Generate a random API key
      const keyBytes = new Uint8Array(32);
      crypto.getRandomValues(keyBytes);
      const fullKey = `svk_${Array.from(keyBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')}`;

      // Hash the key for storage
      const encoder = new TextEncoder();
      const data = encoder.encode(fullKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const keyHash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const keyPrefix = fullKey.substring(0, 12);

      const { data: apiKeyData, error: createError } = await supabase
        .from('api_keys')
        .insert({
          name,
          key_hash: keyHash,
          key_prefix: keyPrefix,
          user_id: user.id,
        })
        .select()
        .single();

      if (createError) throw createError;

      toast({
        title: 'API key created',
        description: 'Copy your key now - it won\'t be shown again',
      });

      // Return both the stored data and the full key (only shown once)
      return { ...apiKeyData, fullKey };
    } catch (err) {
      const error = err as Error;
      setError(error);
      toast({
        title: 'Error creating API key',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { createApiKey, loading, error };
}

export function useDeleteApiKey() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const deleteApiKey = async (id: string) => {
    try {
      setLoading(true);
      const { error: deleteError } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      toast({
        title: 'API key deleted',
        description: 'The API key has been revoked',
      });

      return true;
    } catch (err) {
      const error = err as Error;
      setError(error);
      toast({
        title: 'Error deleting API key',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { deleteApiKey, loading, error };
}
