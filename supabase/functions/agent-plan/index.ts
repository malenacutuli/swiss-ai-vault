import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const LOVABLE_AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { prompt, systemPrompt, task_id, mode } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('[agent-plan] Creating plan for task:', task_id);

    // Default system prompt for planning
    const defaultSystemPrompt = `You are an AI planning agent that creates structured execution plans.
Analyze the user's request and create a step-by-step plan with concrete, actionable steps.

Available tool categories:
- shell: Execute shell commands (shell.exec, shell.view)
- file: File operations (file.read, file.write, file.edit, file.delete)
- browser: Web automation (browser.navigate, browser.click, browser.type, browser.screenshot)
- search: Search capabilities (search.web, search.code)
- webdev: Web development (webdev.init, webdev.preview)
- plan: Plan management (plan.update, plan.advance)
- message: User communication (message.info, message.ask)

Create 2-6 focused steps that accomplish the task using these tools.
Always respond with valid JSON matching the requested schema.`;

    // Call Lovable AI Gateway
    const aiResponse = await fetch(LOVABLE_AI_GATEWAY, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt || defaultSystemPrompt },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[agent-plan] AI Gateway error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Credits exhausted. Please add funds to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Return a default plan on error
      return new Response(
        JSON.stringify({
          plan: createDefaultPlan(prompt),
          source: 'fallback',
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    console.log('[agent-plan] AI response length:', content.length);

    // Parse JSON from response
    let plan;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/```json\s*([\s\S]*?)```/) || 
                        content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        plan = JSON.parse(jsonStr);
      } else {
        // Try parsing the whole content as JSON
        plan = JSON.parse(content);
      }
    } catch (parseError) {
      console.error('[agent-plan] JSON parse error:', parseError);
      plan = createDefaultPlan(prompt);
    }

    // Validate plan structure
    if (!plan.steps || !Array.isArray(plan.steps)) {
      plan = createDefaultPlan(prompt);
    }

    // Log plan creation
    if (task_id) {
      await supabase.from('agent_task_logs').insert({
        task_id,
        log_type: 'info',
        content: `📋 Plan created: ${plan.title || 'Execution Plan'}`,
        sequence_number: Date.now(),
        metadata: { stepCount: plan.steps?.length || 0 },
      });
    }

    return new Response(
      JSON.stringify({ plan, source: 'ai' }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error('[agent-plan] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        plan: createDefaultPlan(''), 
        source: 'error_fallback' 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Fallback plan generator
function createDefaultPlan(prompt: string) {
  const isCodeTask = prompt.includes('```') || 
                     prompt.toLowerCase().includes('code') ||
                     prompt.toLowerCase().includes('script');

  if (isCodeTask) {
    return {
      title: "Code Execution",
      objective: prompt.substring(0, 100),
      steps: [
        { number: 1, title: "Parse code", description: "Extract and validate code from request", tools: ["file.read"] },
        { number: 2, title: "Execute code", description: "Run code in secure sandbox", tools: ["shell.exec"] },
        { number: 3, title: "Collect output", description: "Gather execution results", tools: ["shell.view"] },
      ],
      estimatedDuration: "1-2 minutes"
    };
  }

  return {
    title: "Task Execution",
    objective: prompt.substring(0, 100) || "Execute user request",
    steps: [
      { number: 1, title: "Analyze request", description: "Understand and parse requirements", tools: ["message.info"] },
      { number: 2, title: "Execute task", description: "Perform the requested action", tools: ["search.web"] },
      { number: 3, title: "Deliver results", description: "Format and present the output", tools: ["message.info"] },
    ],
    estimatedDuration: "2-5 minutes"
  };
}
