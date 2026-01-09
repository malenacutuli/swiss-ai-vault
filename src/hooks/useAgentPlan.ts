import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { todoParser, type TodoPlan, type TaskStatus } from '@/lib/agents/planning';
import { useToast } from '@/hooks/use-toast';

interface UseAgentPlanOptions {
  taskId?: string;
  autoSaveInterval?: number; // Default 5000ms
  onPlanUpdate?: (plan: TodoPlan) => void;
}

interface AgentPlanState {
  plan: TodoPlan | null;
  planId: string | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  lastSaved: Date | null;
}

export function useAgentPlan(options: UseAgentPlanOptions = {}) {
  const { taskId, autoSaveInterval = 5000, onPlanUpdate } = options;
  const { toast } = useToast();
  
  const [state, setState] = useState<AgentPlanState>({
    plan: null,
    planId: null,
    isLoading: false,
    isSaving: false,
    error: null,
    lastSaved: null,
  });

  const planRef = useRef<TodoPlan | null>(null);
  const isDirtyRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Load plan from database
  const loadPlan = useCallback(async (targetTaskId: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('agent_plans')
        .select('*')
        .eq('task_id', targetTaskId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        const plan = todoParser.parse(data.plan_markdown);
        planRef.current = plan;
        setState(prev => ({
          ...prev,
          plan,
          planId: data.id,
          isLoading: false,
          lastSaved: new Date(data.updated_at),
        }));
        return plan;
      }

      setState(prev => ({ ...prev, isLoading: false }));
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load plan';
      setState(prev => ({ ...prev, isLoading: false, error: message }));
      return null;
    }
  }, []);

  // Save plan to database
  const savePlan = useCallback(async (force = false) => {
    if (!planRef.current || (!isDirtyRef.current && !force)) return;
    
    const plan = planRef.current;
    
    setState(prev => ({ ...prev, isSaving: true }));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const markdown = todoParser.serialize(plan);
      const planData = {
        task_id: taskId || null,
        user_id: user.id,
        plan_markdown: markdown,
        plan_title: plan.title,
        current_phase: plan.currentPhase,
        total_phases: plan.phases.length,
        completed_tasks: plan.completedTasks,
        total_tasks: plan.totalTasks,
        status: plan.completedTasks === plan.totalTasks ? 'completed' : 'active',
        metadata: {
          inProgressTasks: plan.inProgressTasks,
          blockedTasks: plan.blockedTasks,
        },
      };

      if (state.planId) {
        // Update existing
        const { error } = await supabase
          .from('agent_plans')
          .update(planData)
          .eq('id', state.planId);

        if (error) throw error;
      } else {
        // Create new
        const { data, error } = await supabase
          .from('agent_plans')
          .insert(planData)
          .select('id')
          .single();

        if (error) throw error;
        setState(prev => ({ ...prev, planId: data.id }));
      }

      isDirtyRef.current = false;
      setState(prev => ({ ...prev, isSaving: false, lastSaved: new Date() }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save plan';
      setState(prev => ({ ...prev, isSaving: false, error: message }));
      toast({
        title: 'Save failed',
        description: message,
        variant: 'destructive',
      });
    }
  }, [taskId, state.planId, toast]);

  // Create a new plan
  const createPlan = useCallback(async (
    title: string,
    phases: Array<{ name: string; tasks: string[] }>
  ) => {
    const plan = todoParser.createPlan(title, phases);
    planRef.current = plan;
    isDirtyRef.current = true;
    
    setState(prev => ({ ...prev, plan }));
    onPlanUpdate?.(plan);
    
    await savePlan(true);
    return plan;
  }, [savePlan, onPlanUpdate]);

  // Update a task status
  const updateTask = useCallback(async (taskId: string, status: TaskStatus) => {
    if (!planRef.current) return;

    const updatedPlan = todoParser.updateTask(planRef.current, taskId, status);
    planRef.current = updatedPlan;
    isDirtyRef.current = true;
    
    setState(prev => ({ ...prev, plan: updatedPlan }));
    onPlanUpdate?.(updatedPlan);

    // Schedule save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => savePlan(), autoSaveInterval);
  }, [savePlan, autoSaveInterval, onPlanUpdate]);

  // Complete a task
  const completeTask = useCallback(async (taskId: string, notes?: string) => {
    if (!planRef.current) return;

    const updatedPlan = todoParser.completeTask(planRef.current, taskId, notes);
    planRef.current = updatedPlan;
    isDirtyRef.current = true;
    
    setState(prev => ({ ...prev, plan: updatedPlan }));
    onPlanUpdate?.(updatedPlan);

    // Immediate save on task completion
    await savePlan(true);
  }, [savePlan, onPlanUpdate]);

  // Advance to next phase
  const advancePhase = useCallback(async () => {
    if (!planRef.current) return;

    const updatedPlan = todoParser.advancePhase(planRef.current);
    planRef.current = updatedPlan;
    isDirtyRef.current = true;
    
    setState(prev => ({ ...prev, plan: updatedPlan }));
    onPlanUpdate?.(updatedPlan);

    // Immediate save on phase advance
    await savePlan(true);
  }, [savePlan, onPlanUpdate]);

  // Set plan from markdown
  const setPlanFromMarkdown = useCallback(async (markdown: string) => {
    const plan = todoParser.parse(markdown);
    planRef.current = plan;
    isDirtyRef.current = true;
    
    setState(prev => ({ ...prev, plan }));
    onPlanUpdate?.(plan);

    await savePlan(true);
    return plan;
  }, [savePlan, onPlanUpdate]);

  // Get next task
  const getNextTask = useCallback(() => {
    if (!planRef.current) return null;
    return todoParser.getNextTask(planRef.current);
  }, []);

  // Get progress
  const getProgress = useCallback(() => {
    if (!planRef.current) return 0;
    return todoParser.getProgress(planRef.current);
  }, []);

  // Load plan on mount if taskId provided
  useEffect(() => {
    if (taskId) {
      loadPlan(taskId);
    }
  }, [taskId, loadPlan]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Save on unmount if dirty
      if (isDirtyRef.current && planRef.current) {
        savePlan(true);
      }
    };
  }, [savePlan]);

  // Auto-save interval
  useEffect(() => {
    if (!autoSaveInterval) return;

    const interval = setInterval(() => {
      if (isDirtyRef.current) {
        savePlan();
      }
    }, autoSaveInterval);

    return () => clearInterval(interval);
  }, [autoSaveInterval, savePlan]);

  return {
    ...state,
    createPlan,
    loadPlan,
    savePlan: () => savePlan(true),
    updateTask,
    completeTask,
    advancePhase,
    setPlanFromMarkdown,
    getNextTask,
    getProgress,
    serialize: () => planRef.current ? todoParser.serialize(planRef.current) : '',
  };
}
