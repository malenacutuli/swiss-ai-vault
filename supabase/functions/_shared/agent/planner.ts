// Agent Planner Implementation
// Generates execution plans from user prompts using LLM

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { invokeLLM, extractJSON } from '../llm/index.ts';

// Plan phase definition
export interface PlanPhase {
  phase_number: number;
  name: string;
  description: string;
  required_capabilities: string[];
  estimated_credits: number;
  dependencies: number[]; // Phase numbers this depends on
  expected_outputs: string[];
}

// Complete execution plan
export interface ExecutionPlan {
  goal: string;
  phases: PlanPhase[];
  total_estimated_credits: number;
  total_estimated_duration_minutes: number;
  required_capabilities: string[];
  risks: string[];
}

// Planning constraints
export interface PlanningConstraints {
  max_credits?: number;
  max_phases?: number;
  available_capabilities?: string[];
  context?: {
    user_preferences?: Record<string, unknown>;
    previous_runs?: Array<{
      prompt: string;
      outcome: 'success' | 'failed';
      lessons?: string;
    }>;
  };
}

// Planner class
export class AgentPlanner {
  private supabase: ReturnType<typeof createClient>;
  private userId: string;

  constructor(supabase: ReturnType<typeof createClient>, userId: string) {
    this.supabase = supabase;
    this.userId = userId;
  }

  // Create execution plan from prompt
  async createPlan(
    prompt: string,
    constraints?: PlanningConstraints
  ): Promise<{ plan: ExecutionPlan | null; error?: string }> {
    try {
      // Get user's available credits
      const { data: balance } = await this.supabase
        .from('credit_balances')
        .select('available_credits')
        .eq('user_id', this.userId)
        .single();

      const maxCredits = constraints?.max_credits ?? balance?.available_credits ?? 100;

      // Get available capabilities from connectors
      const { data: connectors } = await this.supabase
        .from('connector_credentials')
        .select('connector_type, status')
        .eq('user_id', this.userId)
        .eq('status', 'active');

      const availableCapabilities = constraints?.available_capabilities ??
        connectors?.map(c => c.connector_type) ??
        ['shell', 'code', 'browser', 'search', 'message'];

      // Build planning prompt
      const systemPrompt = this.buildPlanningSystemPrompt(maxCredits, availableCapabilities);
      const userPrompt = this.buildPlanningUserPrompt(prompt, constraints);

      // Define JSON schema for structured output
      const planSchema = {
        type: 'object',
        required: ['goal', 'phases', 'total_estimated_credits', 'required_capabilities'],
        properties: {
          goal: { type: 'string' },
          phases: {
            type: 'array',
            items: {
              type: 'object',
              required: ['phase_number', 'name', 'description', 'required_capabilities', 'estimated_credits'],
              properties: {
                phase_number: { type: 'number' },
                name: { type: 'string' },
                description: { type: 'string' },
                required_capabilities: { type: 'array', items: { type: 'string' } },
                estimated_credits: { type: 'number' },
                dependencies: { type: 'array', items: { type: 'number' } },
                expected_outputs: { type: 'array', items: { type: 'string' } },
              },
            },
          },
          total_estimated_credits: { type: 'number' },
          total_estimated_duration_minutes: { type: 'number' },
          required_capabilities: { type: 'array', items: { type: 'string' } },
          risks: { type: 'array', items: { type: 'string' } },
        },
      };

      // Call LLM to generate plan
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.7,
        max_tokens: 4096,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'execution_plan',
            strict: true,
            schema: planSchema,
          },
        },
      });

      // Extract plan from response
      const content = response.choices[0]?.message?.content;
      if (!content) {
        return { plan: null, error: 'No response from LLM' };
      }

      const planData = extractJSON(content);
      if (!planData) {
        return { plan: null, error: 'Failed to parse plan JSON' };
      }

      const plan = planData as ExecutionPlan;

      // Validate plan
      const validation = await this.validatePlan(plan, constraints);
      if (!validation.valid) {
        return { plan: null, error: validation.error };
      }

      return { plan };
    } catch (error) {
      console.error('Planning error:', error);
      return {
        plan: null,
        error: error instanceof Error ? error.message : 'Unknown planning error'
      };
    }
  }

  // Re-plan after failure
  async replan(
    originalPlan: ExecutionPlan,
    failedPhaseNumber: number,
    errorMessage: string,
    constraints?: PlanningConstraints
  ): Promise<{ plan: ExecutionPlan | null; error?: string }> {
    try {
      const systemPrompt = `You are an AI task planner. A previous execution plan has failed and needs to be revised.

ORIGINAL PLAN:
${JSON.stringify(originalPlan, null, 2)}

FAILURE DETAILS:
- Failed at phase ${failedPhaseNumber}: ${originalPlan.phases.find(p => p.phase_number === failedPhaseNumber)?.name}
- Error: ${errorMessage}

Your task is to create a REVISED execution plan that:
1. Addresses the failure by modifying the failed phase or adding recovery steps
2. Keeps successful phases unchanged if possible
3. May add new phases before/after the failed phase
4. Adjusts credit estimates based on what was already consumed
5. Learns from the failure to prevent similar issues

Return a complete revised execution plan in JSON format.`;

      const userPrompt = `Revise the plan to fix the failure. Original goal: ${originalPlan.goal}`;

      const planSchema = {
        type: 'object',
        required: ['goal', 'phases', 'total_estimated_credits', 'required_capabilities'],
        properties: {
          goal: { type: 'string' },
          phases: {
            type: 'array',
            items: {
              type: 'object',
              required: ['phase_number', 'name', 'description', 'required_capabilities', 'estimated_credits'],
              properties: {
                phase_number: { type: 'number' },
                name: { type: 'string' },
                description: { type: 'string' },
                required_capabilities: { type: 'array', items: { type: 'string' } },
                estimated_credits: { type: 'number' },
                dependencies: { type: 'array', items: { type: 'number' } },
                expected_outputs: { type: 'array', items: { type: 'string' } },
              },
            },
          },
          total_estimated_credits: { type: 'number' },
          total_estimated_duration_minutes: { type: 'number' },
          required_capabilities: { type: 'array', items: { type: 'string' } },
          risks: { type: 'array', items: { type: 'string' } },
        },
      };

      const response = await invokeLLM({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.7,
        max_tokens: 4096,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'revised_execution_plan',
            strict: true,
            schema: planSchema,
          },
        },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return { plan: null, error: 'No response from LLM for replan' };
      }

      const planData = extractJSON(content);
      if (!planData) {
        return { plan: null, error: 'Failed to parse revised plan JSON' };
      }

      const revisedPlan = planData as ExecutionPlan;

      // Validate revised plan
      const validation = await this.validatePlan(revisedPlan, constraints);
      if (!validation.valid) {
        return { plan: null, error: validation.error };
      }

      return { plan: revisedPlan };
    } catch (error) {
      console.error('Replanning error:', error);
      return {
        plan: null,
        error: error instanceof Error ? error.message : 'Unknown replanning error'
      };
    }
  }

  // Validate plan against constraints
  async validatePlan(
    plan: ExecutionPlan,
    constraints?: PlanningConstraints
  ): Promise<{ valid: boolean; error?: string }> {
    // Check credit constraint
    if (constraints?.max_credits && plan.total_estimated_credits > constraints.max_credits) {
      return {
        valid: false,
        error: `Plan requires ${plan.total_estimated_credits} credits but only ${constraints.max_credits} available`,
      };
    }

    // Check phase count constraint
    if (constraints?.max_phases && plan.phases.length > constraints.max_phases) {
      return {
        valid: false,
        error: `Plan has ${plan.phases.length} phases but maximum is ${constraints.max_phases}`,
      };
    }

    // Check capabilities constraint
    if (constraints?.available_capabilities) {
      const unavailableCapabilities = plan.required_capabilities.filter(
        cap => !constraints.available_capabilities?.includes(cap)
      );
      if (unavailableCapabilities.length > 0) {
        return {
          valid: false,
          error: `Plan requires unavailable capabilities: ${unavailableCapabilities.join(', ')}`,
        };
      }
    }

    // Validate phase structure
    for (const phase of plan.phases) {
      // Check dependencies exist
      if (phase.dependencies) {
        for (const dep of phase.dependencies) {
          if (!plan.phases.find(p => p.phase_number === dep)) {
            return {
              valid: false,
              error: `Phase ${phase.phase_number} depends on non-existent phase ${dep}`,
            };
          }
          // Check dependency is before this phase
          if (dep >= phase.phase_number) {
            return {
              valid: false,
              error: `Phase ${phase.phase_number} has invalid dependency on phase ${dep} (must be earlier)`,
            };
          }
        }
      }

      // Check phase has positive credits
      if (phase.estimated_credits <= 0) {
        return {
          valid: false,
          error: `Phase ${phase.phase_number} has invalid credit estimate: ${phase.estimated_credits}`,
        };
      }
    }

    // Check total credits matches sum of phases
    const phaseCreditsSum = plan.phases.reduce((sum, p) => sum + p.estimated_credits, 0);
    if (Math.abs(phaseCreditsSum - plan.total_estimated_credits) > 0.01) {
      return {
        valid: false,
        error: `Total credits (${plan.total_estimated_credits}) doesn't match sum of phase credits (${phaseCreditsSum})`,
      };
    }

    return { valid: true };
  }

  // Build system prompt for planning
  private buildPlanningSystemPrompt(maxCredits: number, availableCapabilities: string[]): string {
    return `You are an expert AI task planner. Your job is to break down complex user requests into structured execution plans.

AVAILABLE CAPABILITIES:
${availableCapabilities.map(cap => `- ${cap}`).join('\n')}

CREDIT BUDGET: ${maxCredits} credits

CREDIT COSTS (approximate):
- shell command: 1 credit
- code execution: 2 credits
- browser interaction: 3 credits
- web search: 1 credit
- file operation: 1 credit
- LLM call: 5 credits
- message to user: 0 credits

PLANNING RULES:
1. Break the task into logical phases (typically 3-7 phases)
2. Each phase should have a clear goal and measurable outputs
3. Phases should build on each other (use dependencies)
4. Estimate credits conservatively (add 20% buffer)
5. Identify required capabilities for each phase
6. Flag potential risks (missing data, complex operations, etc.)
7. Stay within the credit budget
8. Phases should be atomic - completable in one execution cycle

OUTPUT FORMAT:
Return a JSON object with this structure:
{
  "goal": "Clear statement of what we're trying to accomplish",
  "phases": [
    {
      "phase_number": 1,
      "name": "Phase name",
      "description": "Detailed description of what this phase does",
      "required_capabilities": ["shell", "code"],
      "estimated_credits": 10,
      "dependencies": [],
      "expected_outputs": ["List of concrete outputs this phase produces"]
    }
  ],
  "total_estimated_credits": 50,
  "total_estimated_duration_minutes": 15,
  "required_capabilities": ["shell", "code", "browser"],
  "risks": ["Potential issues or challenges"]
}`;
  }

  // Build user prompt for planning
  private buildPlanningUserPrompt(prompt: string, constraints?: PlanningConstraints): string {
    let userPrompt = `Create an execution plan for this request:\n\n${prompt}`;

    if (constraints?.context?.previous_runs && constraints.context.previous_runs.length > 0) {
      userPrompt += '\n\nPREVIOUS ATTEMPTS:\n';
      for (const run of constraints.context.previous_runs) {
        userPrompt += `- Prompt: "${run.prompt}" → ${run.outcome}`;
        if (run.lessons) {
          userPrompt += ` (Lesson: ${run.lessons})`;
        }
        userPrompt += '\n';
      }
    }

    if (constraints?.context?.user_preferences) {
      userPrompt += '\n\nUSER PREFERENCES:\n';
      userPrompt += JSON.stringify(constraints.context.user_preferences, null, 2);
    }

    return userPrompt;
  }

  // Get plan summary for a run
  async getPlanSummary(runId: string): Promise<ExecutionPlan | null> {
    const { data: run } = await this.supabase
      .from('agent_runs')
      .select('execution_plan')
      .eq('id', runId)
      .single();

    return run?.execution_plan as ExecutionPlan | null;
  }

  // Update plan in database
  async savePlan(runId: string, plan: ExecutionPlan): Promise<boolean> {
    const { error } = await this.supabase
      .from('agent_runs')
      .update({ execution_plan: plan })
      .eq('id', runId);

    return !error;
  }
}
