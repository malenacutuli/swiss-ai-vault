// Agent Planner - Creates execution plans for agent tasks

export interface PlanPhase {
  id: string;
  name: string;
  description: string;
  tools: string[];
  estimated_duration_seconds?: number;
  depends_on?: string[];
}

export interface ExecutionPlan {
  id: string;
  title: string;
  phases: PlanPhase[];
  total_phases: number;
  estimated_total_duration_seconds?: number;
  created_at: string;
}

export interface PlanResult {
  plan?: ExecutionPlan;
  error?: string;
}

export class AgentPlanner {
  private supabase: any;
  private userId: string;

  constructor(supabase: any, userId: string) {
    this.supabase = supabase;
    this.userId = userId;
  }

  async createPlan(prompt: string, context?: Record<string, any>): Promise<PlanResult> {
    try {
      // Generate a simple plan based on prompt analysis
      const plan = await this.generatePlan(prompt, context);
      return { plan };
    } catch (err: any) {
      return { error: err.message };
    }
  }

  private async generatePlan(prompt: string, context?: Record<string, any>): Promise<ExecutionPlan> {
    const promptLower = prompt.toLowerCase();
    const phases: PlanPhase[] = [];

    // Analyze prompt to determine required phases
    if (promptLower.includes('research') || promptLower.includes('search') || promptLower.includes('find')) {
      phases.push({
        id: 'research',
        name: 'Research & Discovery',
        description: 'Search and gather relevant information',
        tools: ['web_search', 'document_search'],
        estimated_duration_seconds: 60,
      });
    }

    if (promptLower.includes('analyze') || promptLower.includes('analysis')) {
      phases.push({
        id: 'analysis',
        name: 'Analysis',
        description: 'Analyze gathered information',
        tools: ['llm_analysis'],
        estimated_duration_seconds: 30,
        depends_on: phases.length > 0 ? [phases[phases.length - 1].id] : undefined,
      });
    }

    if (promptLower.includes('write') || promptLower.includes('create') || promptLower.includes('generate')) {
      phases.push({
        id: 'generation',
        name: 'Content Generation',
        description: 'Generate requested content',
        tools: ['llm_generation', 'document_writer'],
        estimated_duration_seconds: 45,
        depends_on: phases.length > 0 ? [phases[phases.length - 1].id] : undefined,
      });
    }

    // Default phase if no specific phases detected
    if (phases.length === 0) {
      phases.push({
        id: 'default',
        name: 'Process Request',
        description: 'Process the user request',
        tools: ['llm_generation'],
        estimated_duration_seconds: 30,
      });
    }

    // Always add a synthesis phase at the end
    phases.push({
      id: 'synthesis',
      name: 'Synthesis & Output',
      description: 'Compile results and generate final output',
      tools: ['llm_synthesis'],
      estimated_duration_seconds: 20,
      depends_on: phases.length > 0 ? [phases[phases.length - 1].id] : undefined,
    });

    const totalDuration = phases.reduce(
      (sum, p) => sum + (p.estimated_duration_seconds || 0),
      0
    );

    return {
      id: crypto.randomUUID(),
      title: `Plan for: ${prompt.substring(0, 50)}...`,
      phases,
      total_phases: phases.length,
      estimated_total_duration_seconds: totalDuration,
      created_at: new Date().toISOString(),
    };
  }

  async savePlan(runId: string, plan: ExecutionPlan): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('agent_runs')
        .update({
          execution_plan: plan,
          total_phases: plan.total_phases,
          updated_at: new Date().toISOString(),
        })
        .eq('id', runId);

      if (error) {
        return { success: false, error: error.message };
      }

      // Also save to agent_plans table
      await this.supabase.from('agent_plans').insert({
        task_id: runId,
        user_id: this.userId,
        plan_title: plan.title,
        plan_markdown: JSON.stringify(plan, null, 2),
        total_phases: plan.total_phases,
        status: 'active',
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
