import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Available tools for the agent
const AVAILABLE_TOOLS = {
  web_search: {
    name: 'web_search',
    description: 'Search the web for current information, news, and research',
    function: 'ghost-web-search',
  },
  document_generator: {
    name: 'document_generator',
    description: 'Generate professional documents: PPTX presentations, DOCX reports, XLSX spreadsheets, PDF files',
    function: 'document-generator',
  },
  image_generator: {
    name: 'image_generator',
    description: 'Generate images using AI models',
    function: 'ghost-image-gen',
  },
  code_executor: {
    name: 'code_executor',
    description: 'Execute code in a secure sandbox environment',
    function: 'code-sandbox',
  },
  data_analyzer: {
    name: 'data_analyzer',
    description: 'Analyze data, create visualizations, and generate insights',
    function: 'data-analyzer',
  },
  slack_integration: {
    name: 'slack_integration',
    description: 'Send messages to Slack channels and users',
    function: 'slack-sync',
  },
  notion_integration: {
    name: 'notion_integration',
    description: 'Create and update Notion pages and databases',
    function: 'notion-sync',
  },
  gmail_integration: {
    name: 'gmail_integration',
    description: 'Send emails and manage Gmail inbox',
    function: 'gmail-sync',
  },
  github_integration: {
    name: 'github_integration',
    description: 'Interact with GitHub repositories, issues, and pull requests',
    function: 'github-sync',
  },
  memory_search: {
    name: 'memory_search',
    description: 'Search through user\'s personal memory and documents',
    function: 'search-documents',
  },
} as const;

interface AgentRequest {
  prompt: string;
  taskType?: 'general' | 'research' | 'document' | 'data' | 'code';
  mode?: 'agent' | 'chat' | 'adaptive';
  privacyTier?: 'ghost' | 'vault' | 'agent';
  connectors?: string[];
  outputType?: 'pptx' | 'docx' | 'xlsx' | 'pdf' | 'none';
  context?: { documents?: string[]; memory?: string };
}

interface PlanStep {
  step_number: number;
  description: string;
  tool: string;
  tool_input: Record<string, unknown>;
}

interface ExecutionPlan {
  plan_summary: string;
  steps: PlanStep[];
  estimated_tokens: number;
  output_type: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Agent execute request from user: ${user.id}`);

    // Parse request
    const request: AgentRequest = await req.json();
    
    if (!request.prompt || request.prompt.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Prompt is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const taskType = request.taskType || 'general';
    const mode = request.mode || 'agent';
    const privacyTier = request.privacyTier || 'vault';
    const connectors = request.connectors || [];
    const outputType = request.outputType || 'none';

    console.log(`Creating task: type=${taskType}, mode=${mode}, privacy=${privacyTier}`);

    // Create agent_tasks record with status='planning'
    const { data: task, error: taskError } = await supabase
      .from('agent_tasks')
      .insert({
        user_id: user.id,
        prompt: request.prompt,
        task_type: taskType,
        mode: mode,
        privacy_tier: privacyTier,
        status: 'planning',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (taskError || !task) {
      console.error('Failed to create task:', taskError);
      return new Response(
        JSON.stringify({ error: 'Failed to create task' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Task created: ${task.id}`);

    // Build available tools list for the system prompt
    const availableToolsList = Object.values(AVAILABLE_TOOLS)
      .map(tool => `- ${tool.name}: ${tool.description}`)
      .join('\n');

    // Build connected integrations list
    const connectedIntegrations = connectors.length > 0 
      ? `Connected integrations: ${connectors.join(', ')}`
      : 'No external integrations connected';

    // Build planning prompt
    const systemPrompt = `You are SwissVault Agent, an autonomous AI assistant that plans and executes complex tasks.

## Available Tools
${availableToolsList}

## User Context
- Privacy Tier: ${privacyTier} (${privacyTier === 'ghost' ? 'maximum privacy, no data retention' : privacyTier === 'vault' ? 'encrypted storage' : 'standard agent mode'})
- ${connectedIntegrations}
- Requested Output Type: ${outputType}
${request.context?.memory ? `- User Memory Context: ${request.context.memory}` : ''}
${request.context?.documents ? `- Attached Documents: ${request.context.documents.length} files` : ''}

## Your Task
Analyze the user's request and create an execution plan. Break down the task into discrete steps, each using one of the available tools.

## Response Format
Respond with ONLY valid JSON in this exact format:
{
  "plan_summary": "Brief 1-2 sentence description of what you will accomplish",
  "steps": [
    {
      "step_number": 1,
      "description": "What this step accomplishes",
      "tool": "tool_name from available tools",
      "tool_input": { "key": "value pairs for the tool" }
    }
  ],
  "estimated_tokens": 5000,
  "output_type": "${outputType}"
}

Important:
- Keep plans focused and efficient (typically 3-7 steps)
- Only use tools from the available list
- Consider the privacy tier when planning
- If output_type is specified, ensure final step produces that format`;

    const userPrompt = `Create an execution plan for this task:\n\n${request.prompt}`;

    // Call Lovable AI to generate plan
    console.log('Calling AI for planning...');
    
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      // Update task status to failed
      await supabase
        .from('agent_tasks')
        .update({ status: 'failed', error_message: `AI planning failed: ${aiResponse.status}` })
        .eq('id', task.id);

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add funds.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to generate execution plan' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const planContent = aiData.choices?.[0]?.message?.content;

    if (!planContent) {
      console.error('No content in AI response');
      await supabase
        .from('agent_tasks')
        .update({ status: 'failed', error_message: 'AI returned empty plan' })
        .eq('id', task.id);
      
      return new Response(
        JSON.stringify({ error: 'AI returned empty plan' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('AI response received, parsing plan...');

    // Parse the plan JSON
    let plan: ExecutionPlan;
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanContent = planContent.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.slice(7);
      }
      if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith('```')) {
        cleanContent = cleanContent.slice(0, -3);
      }
      plan = JSON.parse(cleanContent.trim());
    } catch (parseError) {
      console.error('Failed to parse plan JSON:', parseError, planContent);
      await supabase
        .from('agent_tasks')
        .update({ status: 'failed', error_message: 'Failed to parse AI plan' })
        .eq('id', task.id);
      
      return new Response(
        JSON.stringify({ error: 'Failed to parse execution plan' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate plan structure
    if (!plan.steps || !Array.isArray(plan.steps) || plan.steps.length === 0) {
      console.error('Invalid plan structure:', plan);
      await supabase
        .from('agent_tasks')
        .update({ status: 'failed', error_message: 'Invalid plan structure' })
        .eq('id', task.id);
      
      return new Response(
        JSON.stringify({ error: 'Invalid execution plan structure' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Plan parsed: ${plan.steps.length} steps`);

    // Update task with plan details and status='executing'
    const { error: updateError } = await supabase
      .from('agent_tasks')
      .update({
        status: 'executing',
        plan_summary: plan.plan_summary,
        plan_json: plan,
        total_steps: plan.steps.length,
        tokens_used: plan.estimated_tokens || 0,
      })
      .eq('id', task.id);

    if (updateError) {
      console.error('Failed to update task:', updateError);
    }

    // Create agent_task_steps records for each planned step
    const stepsToInsert = plan.steps.map((step) => ({
      task_id: task.id,
      step_number: step.step_number,
      step_type: 'tool_call',
      description: step.description,
      tool_name: step.tool,
      tool_input: step.tool_input,
      status: 'pending',
    }));

    const { error: stepsError } = await supabase
      .from('agent_task_steps')
      .insert(stepsToInsert);

    if (stepsError) {
      console.error('Failed to create task steps:', stepsError);
    }

    console.log(`Task ${task.id} planned successfully with ${plan.steps.length} steps`);

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        task_id: task.id,
        plan_summary: plan.plan_summary,
        total_steps: plan.steps.length,
        output_type: plan.output_type || outputType,
        steps: plan.steps.map(s => ({
          step_number: s.step_number,
          description: s.description,
          tool: s.tool,
        })),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Agent execute error:', error);
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
