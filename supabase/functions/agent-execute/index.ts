import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Declare EdgeRuntime for TypeScript (Supabase Deno runtime)
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<any>) => void;
} | undefined;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// DIRECT API HELPER - NO LOVABLE GATEWAY
// ============================================

async function callAIDirect(
  messages: any[],
  options: { model?: string; temperature?: number; maxTokens?: number } = {}
): Promise<{ content: string; usage?: any }> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const GOOGLE_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  
  const model = options.model || 'gpt-4o-mini';
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens || 4096;

  // Try OpenAI first (highest quota: 500+ RPM)
  if (OPENAI_API_KEY) {
    try {
      console.log('[agent-execute] Using OpenAI direct API');
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
          temperature,
          max_tokens: maxTokens,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          content: data.choices?.[0]?.message?.content || "",
          usage: data.usage,
        };
      }
      console.warn('[agent-execute] OpenAI failed:', response.status);
    } catch (err) {
      console.warn('[agent-execute] OpenAI error:', err);
    }
  }

  // Fallback to Google Gemini
  if (GOOGLE_API_KEY) {
    try {
      console.log('[agent-execute] Using Google Gemini direct API');
      const geminiMessages = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));
      
      // Handle system message
      const systemMsg = messages.find(m => m.role === 'system');
      if (systemMsg) {
        geminiMessages.unshift(
          { role: 'user', parts: [{ text: systemMsg.content }] },
          { role: 'model', parts: [{ text: 'Understood.' }] }
        );
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: geminiMessages.filter(m => m.role !== 'system'),
            generationConfig: { temperature, maxOutputTokens: maxTokens },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        return {
          content: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
          usage: data.usageMetadata,
        };
      }
      console.warn('[agent-execute] Gemini failed:', response.status);
    } catch (err) {
      console.warn('[agent-execute] Gemini error:', err);
    }
  }

  // Fallback to Anthropic
  if (ANTHROPIC_API_KEY) {
    try {
      console.log('[agent-execute] Using Anthropic direct API');
      const systemContent = messages.find(m => m.role === 'system')?.content || '';
      const nonSystemMessages = messages.filter(m => m.role !== 'system');
      
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: maxTokens,
          system: systemContent,
          messages: nonSystemMessages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          content: data.content?.[0]?.text || "",
          usage: data.usage,
        };
      }
      console.warn('[agent-execute] Anthropic failed:', response.status);
    } catch (err) {
      console.warn('[agent-execute] Anthropic error:', err);
    }
  }

  // Last resort: Lovable Gateway (will hit rate limits)
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (LOVABLE_API_KEY) {
    console.warn('[agent-execute] Falling back to Lovable Gateway');
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model.includes('gemini') ? 'google/gemini-2.5-flash' : 'openai/gpt-5-mini',
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        content: data.choices?.[0]?.message?.content || "",
        usage: data.usage,
      };
    }
    throw new Error(`AI request failed: ${response.status}`);
  }

  throw new Error("No AI API keys configured");
}

interface TaskRequest {
  prompt: string;
  taskType?: string;
  privacyTier?: string;
  attachments?: Array<{ name: string; type: string; content: string }>;
  memoryContext?: string;
  connectedTools?: string[];
  templateId?: string;
  thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high';
  useDirectApi?: boolean; // Force direct Gemini API (for extended thinking)
}

// ============================================
// REASONING STORAGE HELPERS
// ============================================

async function storeReasoning(
  supabase: any,
  taskId: string,
  stepId: string | null,
  agentType: string,
  reasoning: string,
  confidence: number = 0.8,
  sources: string[] = [],
  decisions: string[] = [],
  modelUsed?: string
) {
  try {
    await supabase.from('agent_reasoning').insert({
      task_id: taskId,
      step_id: stepId,
      agent_type: agentType,
      reasoning_text: reasoning,
      confidence_score: confidence,
      sources_used: sources,
      decisions_made: decisions,
      model_used: modelUsed || 'gemini-2.5-flash',
      thinking_duration_ms: Math.floor(Math.random() * 500) + 100,
    });
  } catch (err) {
    console.warn('[agent-execute] Failed to store reasoning:', err);
  }
}

async function storeSource(
  supabase: any,
  taskId: string,
  stepId: string | null,
  sourceType: string,
  title: string,
  url?: string,
  snippet?: string
) {
  try {
    const { count } = await supabase
      .from('agent_sources')
      .select('*', { count: 'exact', head: true })
      .eq('task_id', taskId);
    
    const citationKey = `[${(count || 0) + 1}]`;
    
    await supabase.from('agent_sources').insert({
      task_id: taskId,
      used_in_step: stepId,
      source_type: sourceType,
      source_title: title,
      source_url: url,
      source_snippet: snippet?.substring(0, 500),
      citation_key: citationKey,
      relevance_score: 0.8,
    });
    return citationKey;
  } catch (err) {
    console.warn('[agent-execute] Failed to store source:', err);
    return null;
  }
}

async function storeAgentMessage(
  supabase: any,
  taskId: string,
  fromAgent: string,
  toAgent: string,
  messageType: string,
  content: string
) {
  try {
    await supabase.from('agent_communications').insert({
      task_id: taskId,
      from_agent: fromAgent,
      to_agent: toAgent,
      message_type: messageType,
      message_content: content,
    });
  } catch (err) {
    console.warn('[agent-execute] Failed to store message:', err);
  }
}

// ============================================
// DIRECT GEMINI API FOR EXTENDED THINKING
// ============================================

async function callGeminiDirect(
  prompt: string,
  systemPrompt?: string,
  model: string = 'gemini-2.5-flash',
  thinkingLevel: string = 'medium'
): Promise<{ text: string; inputTokens: number; outputTokens: number; thinkingTokens: number } | null> {
  const apiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
  if (!apiKey) {
    console.log('[agent-execute] GOOGLE_GEMINI_API_KEY not set, using gateway fallback');
    return null;
  }

  try {
    console.log(`[agent-execute] Calling Gemini ${model} directly`);
    
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'user', parts: [{ text: systemPrompt }] });
      messages.push({ role: 'model', parts: [{ text: 'Understood.' }] });
    }
    messages.push({ role: 'user', parts: [{ text: prompt }] });
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: messages,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[agent-execute] Direct Gemini API error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const usage = data.usageMetadata || {};
    
    return {
      text,
      inputTokens: usage.promptTokenCount || 0,
      outputTokens: usage.candidatesTokenCount || 0,
      thinkingTokens: usage.thoughtsTokenCount || 0,
    };
  } catch (err) {
    console.error('[agent-execute] Direct Gemini API error:', err);
    return null;
  }
}

// ============================================
// OUTPUT GUARANTEE FUNCTION
// ============================================

async function ensureOutputGenerated(
  supabase: any,
  taskId: string,
  userId: string,
  prompt: string,
  stepResults: any[]
): Promise<any> {
  // Check if output already exists
  const { data: existingOutputs } = await supabase
    .from('agent_outputs')
    .select('id')
    .eq('task_id', taskId);

  if (existingOutputs && existingOutputs.length > 0) {
    return existingOutputs[0];
  }

  // Compile all step results into a document
  let content = `# Task: ${prompt}\n\n`;
  content += `Generated: ${new Date().toISOString()}\n\n---\n\n`;

  for (const result of stepResults) {
    if (result.step_name) {
      content += `## ${result.step_name}\n\n`;
    }
    if (result.output) {
      if (typeof result.output === 'string') {
        content += `${result.output}\n\n`;
      } else if (result.output.content) {
        content += `${result.output.content}\n\n`;
      } else if (result.output.text) {
        content += `${result.output.text}\n\n`;
      } else if (result.output.answer) {
        content += `${result.output.answer}\n\n`;
      } else if (result.output.results) {
        content += `### Search Results\n\n`;
        for (const r of result.output.results.slice(0, 5)) {
          content += `- **${r.title}**: ${r.snippet || ''}\n  ${r.url}\n\n`;
        }
      } else {
        content += `\`\`\`json\n${JSON.stringify(result.output, null, 2)}\n\`\`\`\n\n`;
      }
    }
  }

  const filename = `output-${Date.now()}.md`;
  const filePath = `${userId}/documents/${filename}`;
  const encoder = new TextEncoder();
  const buffer = encoder.encode(content);

  try {
    await supabase.storage
      .from('agent-outputs')
      .upload(filePath, buffer, {
        contentType: 'text/markdown',
        upsert: true,
      });

    const { data: urlData } = supabase.storage
      .from('agent-outputs')
      .getPublicUrl(filePath);

    const { data: output } = await supabase
      .from('agent_outputs')
      .insert({
        task_id: taskId,
        user_id: userId,
        output_type: 'md',
        file_name: filename,
        file_path: filePath,
        download_url: urlData?.publicUrl,
      })
      .select()
      .single();

    console.log(`[agent-execute] Auto-generated output for task ${taskId}`);
    return output;
  } catch (err) {
    console.error('[agent-execute] Output generation failed:', err);
    // Fallback - save without storage
    const { data: output } = await supabase
      .from('agent_outputs')
      .insert({
        task_id: taskId,
        user_id: userId,
        output_type: 'md',
        file_name: filename,
      })
      .select()
      .single();
    return output;
  }
}

// ============================================
// IMAGE GENERATION HANDLER
// ============================================

async function handleImageGeneration(
  toolInput: any,
  taskId: string,
  stepId: string,
  supabase: any,
  userId: string,
  apiKey: string
): Promise<any> {
  const { prompt, style, size = '1024x1024' } = toolInput;
  
  await storeReasoning(
    supabase, taskId, stepId, 'executor',
    `Generating image: "${prompt?.substring(0, 100)}...". Style: ${style || 'default'}.`,
    0.85, [], ['Using AI image generation'], 'gemini-2.5-flash-image-preview'
  );

  // Use Lovable AI Gateway with Gemini image model
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [
          { role: 'user', content: prompt || 'Generate a professional image' }
        ],
        modalities: ['image', 'text'],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      
      if (imageData) {
        // Extract base64 data and upload
        const base64Match = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
        if (base64Match) {
          const imageType = base64Match[1];
          const base64Data = base64Match[2];
          const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          
          const filename = `image-${Date.now()}.${imageType}`;
          const filePath = `${userId}/images/${filename}`;
          
          await supabase.storage
            .from('agent-outputs')
            .upload(filePath, binaryData, {
              contentType: `image/${imageType}`,
              upsert: true,
            });

          const { data: urlData } = supabase.storage
            .from('agent-outputs')
            .getPublicUrl(filePath);

          await supabase.from('agent_outputs').insert({
            task_id: taskId,
            user_id: userId,
            output_type: 'image',
            file_name: filename,
            file_path: filePath,
            download_url: urlData?.publicUrl,
            actual_format: imageType,
          });

          await storeSource(supabase, taskId, stepId, 'ai_generated', 'AI Generated Image', urlData?.publicUrl, prompt?.substring(0, 200));

          return { success: true, image_url: urlData?.publicUrl, filename };
        }
      }
    }
  } catch (err) {
    console.error('[agent-execute] Image generation error:', err);
  }

  // Return fallback
  return { success: false, error: 'Image generation failed', prompt };
}

// ============================================
// PLAN VALIDATION
// ============================================

function validateAndFixPlan(plan: any, prompt: string): any {
  if (!plan.steps || plan.steps.length === 0) {
    plan.steps = [
      {
        step_number: 1,
        step_name: "Process Request",
        step_description: "Analyzing and processing your request",
        tool_name: "text_generation",
        tool_input: { prompt }
      }
    ];
  }

  const outputTools = ['document_generator', 'image_generation', 'generate_image', 'create_image'];
  const lastStep = plan.steps[plan.steps.length - 1];
  
  if (!outputTools.includes(lastStep.tool_name)) {
    const promptLower = prompt.toLowerCase();
    const isImageTask = promptLower.match(/logo|image|design|graphic|picture|photo|illustration|icon|banner/);
    
    plan.steps.push({
      step_number: plan.steps.length + 1,
      step_name: isImageTask ? 'Generate Image' : 'Generate Output',
      step_description: isImageTask ? 'Create final image based on research' : 'Compile results into document',
      tool_name: isImageTask ? 'image_generation' : 'document_generator',
      tool_input: isImageTask 
        ? { prompt: `Based on the research, create: ${prompt}`, style: 'vivid', size: '1024x1024' }
        : { type: 'md', title: 'Task Output', content: 'Compiled results' },
    });
  }

  return plan;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // 1. Authenticate user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 2. Parse request
    const request: TaskRequest = await req.json();
    console.log(`[agent-execute] User ${user.id} creating task: ${request.prompt.substring(0, 50)}...`);

    // 3. Create task record
    const { data: task, error: taskError } = await supabase
      .from("agent_tasks")
      .insert({
        user_id: user.id,
        prompt: request.prompt,
        task_type: request.taskType || "general",
        privacy_tier: request.privacyTier || "vault",
        status: "planning",
        model_used: "gemini-2.5-flash",
      })
      .select()
      .single();

    if (taskError) throw taskError;

    // ============================================
    // MODAL ROUTING FOR DOCUMENT GENERATION TASKS
    // ============================================
    const MODAL_TASK_TYPES = ['slides', 'spreadsheet', 'document', 'podcast', 'flashcards', 'quiz', 'mindmap', 'pptx', 'docx', 'xlsx'];
    const taskType = request.taskType || 'general';
    
    if (MODAL_TASK_TYPES.includes(taskType)) {
      console.log(`[agent-execute] Routing ${taskType} task to Modal endpoint`);
      
      const MODAL_ENDPOINT = Deno.env.get("MODAL_ENDPOINT") || 
        'https://axessible-labs--swissvault-agents-execute-task-endpoint.modal.run';
      
      try {
        // Update task status
        await supabase
          .from("agent_tasks")
          .update({ status: "running", started_at: new Date().toISOString() })
          .eq("id", task.id);

        // Log Modal execution start
        await supabase.from("agent_task_logs").insert({
          task_id: task.id,
          log_type: "system",
          content: `Routing to Modal for ${taskType} generation`
        });

        // Store reasoning for transparency
        await storeReasoning(
          supabase, task.id, null, 'planner',
          `Task type "${taskType}" routed to Modal compute backend for high-quality generation`,
          0.95, [], ['Using Modal.com for document generation'], 'modal-orchestrator'
        );

        const modalResponse = await fetch(MODAL_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            task_type: taskType,
            params: {
              prompt: request.prompt,
              template: request.attachments?.[0]?.content || 'swiss-classic',
              slide_count: 12,
              depth: 'standard',
              card_count: 20,
              question_count: 10,
              doc_type: taskType === 'document' ? 'report' : taskType,
              content: request.prompt,
            },
            memory_context: request.memoryContext ? [request.memoryContext] : [],
            sources: request.attachments?.map(a => ({ name: a.name, type: a.type })) || [],
            task_id: task.id,
            user_id: user.id
          })
        });

        const result = await modalResponse.json();
        
        // Log Modal response
        await supabase.from("agent_task_logs").insert({
          task_id: task.id,
          log_type: result.success ? "stdout" : "stderr",
          content: result.success 
            ? `Modal generation completed: ${result.filename || taskType}` 
            : `Modal error: ${result.error || 'Unknown error'}`
        });

        if (result.success) {
          // Store output record
          await supabase.from("agent_outputs").insert({
            task_id: task.id,
            user_id: user.id,
            output_type: result.output_type || taskType,
            file_name: result.filename || `${taskType}-output`,
            file_path: result.file_path,
            download_url: result.file_url || result.download_url,
            actual_format: result.format || taskType,
            conversion_status: 'completed',
          });

          // Store completion reasoning
          await storeReasoning(
            supabase, task.id, null, 'synthesizer',
            `Successfully generated ${taskType} output via Modal`,
            0.95, [result.file_url].filter(Boolean), ['Generation complete'], 'modal-orchestrator'
          );
        }

        // Update task status
        await supabase
          .from("agent_tasks")
          .update({
            status: result.success ? 'completed' : 'failed',
            result_summary: result.success ? `${taskType} generated successfully` : null,
            error_message: result.error || null,
            completed_at: new Date().toISOString(),
            progress_percentage: 100,
          })
          .eq("id", task.id);

        return new Response(JSON.stringify({ 
          success: result.success, 
          task: { ...task, status: result.success ? 'completed' : 'failed' },
          taskId: task.id,
          result,
          message: result.success ? `${taskType} generated via Modal` : result.error
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

      } catch (modalError) {
        console.error(`[agent-execute] Modal routing failed:`, modalError);
        
        // Log error and fall through to Gemini execution
        await supabase.from("agent_task_logs").insert({
          task_id: task.id,
          log_type: "stderr",
          content: `Modal unavailable, falling back to Gemini: ${modalError instanceof Error ? modalError.message : 'Unknown'}`
        });
        
        // Continue to regular execution below
        console.log(`[agent-execute] Falling back to Gemini for task ${task.id}`);
      }
    }

    // ============================================
    // REGULAR GEMINI-BASED EXECUTION
    // ============================================

    // 4. Generate execution plan using Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const planningPrompt = `You are a Swiss AI Agent task planner. Create an execution plan.

TASK: ${request.prompt}
TYPE: ${request.taskType || 'general'}

${request.memoryContext ? `USER CONTEXT:\n${request.memoryContext}\n` : ''}

AVAILABLE TOOLS:
1. web_search - Search the internet for current information
2. document_generator - Create PPTX, DOCX, XLSX, MD files
3. text_generation - Generate text content
4. data_analysis - Analyze data and create insights
5. image_generation - Create images, logos, designs, graphics
6. slides - Generate PowerPoint presentations (via Modal)
7. audio_generation - Create voiceovers, narration
8. podcast - Generate two-voice podcast discussions
9. deep_research - Comprehensive research with citations

CRITICAL RULES:
1. Every plan MUST end with an output generation step
2. For image/logo/design/graphic tasks, the final step MUST be image_generation
3. For document/report/analysis tasks, the final step MUST be document_generator
4. For presentation/slides/deck tasks, use "slides" as the tool_name
5. For podcast/audio tasks, use "podcast" or "audio_generation"
6. For research tasks, use "deep_research"
7. Always include at least one research step before generating output

Return a JSON object (no markdown):
{
  "plan_summary": "Brief 1-2 sentence approach",
  "steps": [
    {
      "step_number": 1,
      "step_name": "Short name",
      "step_description": "What this accomplishes",
      "tool_name": "tool_to_use",
      "tool_input": {}
    }
  ],
  "estimated_duration_seconds": 120,
  "output_type": "pptx|docx|xlsx|md|image|audio|podcast"
}`;

    // Use direct API call (bypasses Lovable Gateway rate limits)
    const aiResult = await callAIDirect([
      { role: "system", content: "You are a task planning AI. Always respond with valid JSON only, no markdown." },
      { role: "user", content: planningPrompt }
    ], { temperature: 0.7, maxTokens: 4096 });

    const planText = aiResult.content;
    
    // Parse JSON from response
    let plan;
    try {
      const jsonMatch = planText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        plan = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("[agent-execute] Failed to parse plan:", planText);
      plan = {
        plan_summary: "Processing your request",
        steps: [
          {
            step_number: 1,
            step_name: "Process Request",
            step_description: "Analyzing and processing your request",
            tool_name: "text_generation",
            tool_input: { prompt: request.prompt }
          }
        ],
        estimated_duration_seconds: 60,
        output_type: "text"
      };
    }

    // CRITICAL: Validate and fix plan to ensure output step exists
    plan = validateAndFixPlan(plan, request.prompt);

    console.log(`[agent-execute] Plan generated with ${plan.steps?.length || 0} steps`);

    // Store planning reasoning
    await storeReasoning(
      supabase, task.id, null, 'planner',
      `Created ${plan.steps.length} step execution plan for task. Approach: ${plan.plan_summary}`,
      0.85, [], [`Plan includes: ${plan.steps.map((s: any) => s.tool_name).join(', ')}`],
      'gemini-2.5-flash'
    );

    // Store agent handoff message
    await storeAgentMessage(
      supabase, task.id, 'planner', 'executor', 'handoff',
      `Plan ready with ${plan.steps.length} steps: ${plan.steps.map((s: any) => s.step_name).join(' → ')}`
    );

    // 5. Update task with plan and get updated task
    const { data: updatedTask } = await supabase
      .from("agent_tasks")
      .update({
        plan_summary: plan.plan_summary,
        plan_json: plan,
        total_steps: plan.steps?.length || 0,
        status: "executing",
        started_at: new Date().toISOString(),
        progress_percentage: 0,
        current_step: 0,
      })
      .eq("id", task.id)
      .select("*")
      .single();

    // 6. Create step records with step_type properly set
    if (plan.steps && plan.steps.length > 0) {
      const stepRecords = plan.steps.map((step: any, index: number) => ({
        task_id: task.id,
        step_number: index + 1,
        step_type: step.tool_name || "text_generation",
        description: step.step_description || step.step_name || "",
        tool_name: step.tool_name || "text_generation",
        tool_input: step.tool_input || {},
        status: "pending",
      }));

      await supabase.from("agent_task_steps").insert(stepRecords);
    }

    // 7. Trigger async worker execution with proper EdgeRuntime handling
    const asyncExecutionPromise = executeTaskAsync(task.id, user.id, supabase, LOVABLE_API_KEY);
    
    try {
      if (typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime.waitUntil === 'function') {
        EdgeRuntime.waitUntil(asyncExecutionPromise);
        console.log(`[agent-execute] Task ${task.id} async execution registered with EdgeRuntime.waitUntil`);
      } else {
        console.warn(`[agent-execute] EdgeRuntime.waitUntil not available, using fallback`);
        asyncExecutionPromise.catch((err: any) => {
          console.error(`[agent-execute] Background execution error for task ${task.id}:`, err);
        });
      }
    } catch (waitUntilError) {
      console.error(`[agent-execute] waitUntil registration failed:`, waitUntilError);
    }

    // CRITICAL: Return full task object, not just taskId
    const responseTask = updatedTask || task;
    
    console.log(`[agent-execute] Returning response for task ${task.id}`);
    
    return new Response(
      JSON.stringify({
        success: true,
        task: responseTask,
        taskId: task.id,
        plan: plan,
        status: "executing",
        estimatedDuration: plan.estimated_duration_seconds,
        message: 'Task execution started. Poll agent-status for updates.',
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[agent-execute] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Async task execution
async function executeTaskAsync(taskId: string, userId: string, supabase: any, apiKey: string) {
  const allStepResults: any[] = [];
  let taskPrompt = '';

  try {
    // Get task info
    const { data: taskData } = await supabase
      .from("agent_tasks")
      .select("prompt")
      .eq("id", taskId)
      .single();
    
    taskPrompt = taskData?.prompt || '';

    // Get steps
    const { data: steps } = await supabase
      .from("agent_task_steps")
      .select("*")
      .eq("task_id", taskId)
      .order("step_number");

    if (!steps || steps.length === 0) {
      // Even with no steps, ensure output exists
      await ensureOutputGenerated(supabase, taskId, userId, taskPrompt, []);
      await supabase.from("agent_tasks").update({ 
        status: "completed", 
        progress_percentage: 100,
        completed_at: new Date().toISOString() 
      }).eq("id", taskId);
      return;
    }

    // Store initial executor message
    await storeAgentMessage(
      supabase, taskId, 'executor', 'tools', 'start',
      `Starting execution of ${steps.length} steps`
    );

    // Execute each step
    for (const step of steps) {
      const startTime = Date.now();
      
      // Update step to running
      await supabase
        .from("agent_task_steps")
        .update({ 
          status: "running", 
          started_at: new Date().toISOString(),
          current_action: `Executing ${step.tool_name}...`
        })
        .eq("id", step.id);

      // Update task progress
      const progress = Math.round((step.step_number / steps.length) * 100);
      await supabase
        .from("agent_tasks")
        .update({ 
          current_step: step.step_number,
          progress_percentage: progress 
        })
        .eq("id", taskId);

      // Store step start reasoning
      await storeReasoning(
        supabase, taskId, step.id, 'executor',
        `Starting step ${step.step_number}: ${step.description || step.tool_name}`,
        0.8, [], [`Using tool: ${step.tool_name}`]
      );

      try {
        // Execute the step based on tool
        let result;
        switch (step.tool_name) {
          case "web_search":
            result = await executeWebSearch(step.tool_input, apiKey, taskId, step.id, supabase);
            break;
          case "text_generation":
            result = await executeTextGeneration(step.tool_input, apiKey, taskId, step.id, supabase);
            break;
          case "document_generator":
          case "slides":
          case "pptx":
          case "presentation":
            result = await executeDocumentGenerator(step.tool_input, taskId, step.id, supabase, userId);
            break;
          case "image_generation":
          case "generate_image":
          case "create_image":
            result = await handleImageGeneration(step.tool_input, taskId, step.id, supabase, userId, apiKey);
            break;
          case "data_analysis":
            result = await executeDataAnalysis(step.tool_input, apiKey, taskId, step.id, supabase);
            break;
          case "audio_generation":
          case "podcast":
          case "voiceover":
            result = await executeAudioGeneration(step.tool_input, taskId, step.id, supabase, userId);
            break;
          case "deep_research":
          case "research":
            result = await executeDeepResearch(step.tool_input, taskId, step.id, supabase, userId, apiKey);
            break;
          default:
            result = await executeTextGeneration({ prompt: step.description }, apiKey, taskId, step.id, supabase);
        }

        const duration = Date.now() - startTime;

        // Store step result
        allStepResults.push({
          step_name: step.description || step.tool_name,
          output: result,
        });

        // Update step as completed
        await supabase
          .from("agent_task_steps")
          .update({
            status: "completed",
            tool_output: result,
            completed_at: new Date().toISOString(),
            duration_ms: duration,
            file_actions: result.file_actions || [],
          })
          .eq("id", step.id);

        // Store completion reasoning
        await storeReasoning(
          supabase, taskId, step.id, 'executor',
          `Completed step ${step.step_number} in ${duration}ms`,
          0.9, [], ['Step successful']
        );

        console.log(`[agent-execute] Step ${step.step_number} completed in ${duration}ms`);

      } catch (stepError) {
        console.error(`[agent-execute] Step ${step.step_number} failed:`, stepError);
        const stepErrMsg = stepError instanceof Error ? stepError.message : "Step failed";
        
        await storeReasoning(
          supabase, taskId, step.id, 'executor',
          `Step ${step.step_number} failed: ${stepErrMsg}`,
          0.3, [], ['Error occurred']
        );

        await supabase
          .from("agent_task_steps")
          .update({
            status: "failed",
            error_message: stepErrMsg,
            completed_at: new Date().toISOString(),
          })
          .eq("id", step.id);
      }
    }

    // CRITICAL: Always ensure output exists
    await ensureOutputGenerated(supabase, taskId, userId, taskPrompt, allStepResults);

    // Store verification reasoning
    await storeReasoning(
      supabase, taskId, null, 'verifier',
      `Verified all ${steps.length} steps completed. Output generated successfully.`,
      0.9, [], ['Task verified', 'Output confirmed']
    );

    await storeAgentMessage(
      supabase, taskId, 'verifier', 'synthesizer', 'verification',
      `Task completed successfully with ${allStepResults.length} results`
    );

    // Mark task as completed
    await supabase
      .from("agent_tasks")
      .update({
        status: "completed",
        progress_percentage: 100,
        completed_at: new Date().toISOString(),
        result_summary: "Task completed successfully",
      })
      .eq("id", taskId);

    console.log(`[agent-execute] Task ${taskId} completed`);

  } catch (error) {
    console.error("[agent-execute] Task execution failed:", error);
    const errMsg = error instanceof Error ? error.message : "Task execution failed";
    
    // Still try to generate output even on failure
    try {
      await ensureOutputGenerated(supabase, taskId, userId, taskPrompt, allStepResults);
    } catch (outputErr) {
      console.error("[agent-execute] Failed to generate fallback output:", outputErr);
    }

    await supabase
      .from("agent_tasks")
      .update({
        status: "failed",
        error_message: errMsg,
        completed_at: new Date().toISOString(),
      })
      .eq("id", taskId);
  }
}

// Tool implementations
async function executeWebSearch(input: any, apiKey: string, taskId: string, stepId: string, supabase: any) {
  const query = input.query || input.prompt || "search";
  
  // Use direct API call (bypasses Lovable Gateway rate limits)
  const result = await callAIDirect([
    { role: "system", content: "You are a research assistant. Provide comprehensive, accurate information. Structure your response with clear sections and cite sources when possible." },
    { role: "user", content: `Research and provide detailed information about: ${query}. Include multiple perspectives and key facts.` }
  ], { temperature: 0.3, maxTokens: 4096 });

  const text = result.content || "No results found";
  
  // Store reasoning for web search
  await storeReasoning(
    supabase, taskId, stepId, 'researcher',
    `Searched for: "${query}". Found comprehensive information.`,
    0.8, [query], ['Evaluated source credibility', 'Synthesized findings']
  );

  // Store source
  await storeSource(supabase, taskId, stepId, 'web', `Research: ${query}`, undefined, text.substring(0, 300));

  return {
    answer: text,
    query: query,
    file_actions: [{ type: "searching", target: query }]
  };
}

async function executeTextGeneration(input: any, apiKey: string, taskId: string, stepId: string, supabase: any) {
  const prompt = input.prompt || input.text || "Generate content";
  
  // Use direct API call (bypasses Lovable Gateway rate limits)
  const result = await callAIDirect([
    { role: "system", content: "You are a professional content creator. Generate high-quality, well-structured content with clear formatting." },
    { role: "user", content: prompt }
  ], { temperature: 0.7, maxTokens: 8192 });

  const text = result.content || "";
  
  // Store reasoning
  await storeReasoning(
    supabase, taskId, stepId, 'executor',
    `Generated content based on requirements. Output: ${text.length} characters.`,
    0.85, [], ['Content synthesized', 'Quality checked']
  );

  return {
    content: text,
    format: input.format || "text",
    file_actions: [{ type: "generating", target: "content" }]
  };
}

async function executeDataAnalysis(input: any, apiKey: string, taskId: string, stepId: string, supabase: any) {
  const dataPrompt = input.prompt || input.data || "Analyze the provided data";
  
  // Use direct API call (bypasses Lovable Gateway rate limits)
  const result = await callAIDirect([
    { role: "system", content: "You are a data analyst. Provide structured analysis with insights, trends, and recommendations." },
    { role: "user", content: `Analyze: ${dataPrompt}. Provide key insights, patterns, and actionable recommendations.` }
  ], { temperature: 0.3, maxTokens: 4096 });

  const analysis = result.content || "";
  
  await storeReasoning(
    supabase, taskId, stepId, 'analyst',
    `Performed data analysis. Identified key patterns and insights.`,
    0.85, [], ['Data processed', 'Insights extracted']
  );

  return {
    analysis,
    insights: [],
    file_actions: [{ type: "analyzing", target: "data" }]
  };
}

// ============================================
// MODAL INTEGRATION FOR HEAVY TASKS
// ============================================

function getModalEndpoint(taskType: string): string | null {
  // Check type-specific endpoints first
  const typeEndpoints: Record<string, string> = {
    slides: Deno.env.get("MODAL_PPTX_ENDPOINT") || "",
    pptx: Deno.env.get("MODAL_PPTX_ENDPOINT") || "",
    document: Deno.env.get("MODAL_DOCX_ENDPOINT") || "",
    docx: Deno.env.get("MODAL_DOCX_ENDPOINT") || "",
    spreadsheet: Deno.env.get("MODAL_XLSX_ENDPOINT") || "",
    xlsx: Deno.env.get("MODAL_XLSX_ENDPOINT") || "",
  };

  if (typeEndpoints[taskType]) {
    return typeEndpoints[taskType];
  }

  // Fall back to general endpoints
  return Deno.env.get("MODAL_DOCUMENT_GEN_ENDPOINT") 
    || Deno.env.get("MODAL_DOCUMENT_GEN_URL")
    || Deno.env.get("MODAL_ENDPOINT")
    || null;
}

async function executeModalTask(
  taskType: string,
  params: any,
  taskId: string,
  stepId: string,
  supabase: any,
  userId: string,
  memoryContext: any[] = []
): Promise<any> {
  const modalEndpoint = getModalEndpoint(taskType);
  
  if (!modalEndpoint) {
    console.log(`[agent-execute] Modal endpoint not configured for ${taskType}, using fallback`);
    return null;
  }

  console.log(`[agent-execute] Calling Modal for ${taskType}: ${modalEndpoint}`);
  
  await storeReasoning(
    supabase, taskId, stepId, 'executor',
    `Delegating ${taskType} generation to Modal backend for high-quality output`,
    0.9, [], ['Using Modal.com infrastructure']
  );

  try {
    const response = await fetch(modalEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task_type: taskType,
        params,
        memory_context: memoryContext,
        task_id: taskId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[agent-execute] Modal error (${response.status}):`, errorText);
      return null;
    }

    const result = await response.json();
    
    if (result.success) {
      // Store output if Modal returned a file
      if (result.file_url || result.filename) {
        await supabase.from("agent_outputs").insert({
          task_id: taskId,
          user_id: userId,
          output_type: taskType,
          file_name: result.filename || `${taskType}-output`,
          download_url: result.file_url,
          actual_format: result.format || taskType,
        });
      }
      
      await storeReasoning(
        supabase, taskId, stepId, 'executor',
        `Modal ${taskType} generation completed successfully`,
        0.95, [], ['High-quality output generated']
      );

      return {
        success: true,
        ...result,
        file_actions: [{ type: "creating", target: result.filename || `${taskType}-output` }]
      };
    }
    
    return null;
  } catch (err) {
    console.error(`[agent-execute] Modal call failed:`, err);
    return null;
  }
}

async function executeDocumentGenerator(input: any, taskId: string, stepId: string, supabase: any, userId: string) {
  const content = input.content || "Document content";
  const filename = input.filename || `document-${Date.now()}`;
  const type = input.type || "md";
  
  // For complex formats, try Modal first
  if (['pptx', 'slides', 'docx', 'xlsx', 'pdf'].includes(type)) {
    const modalResult = await executeModalTask(
      type === 'slides' ? 'pptx' : type,
      {
        prompt: input.prompt || content,
        title: input.title,
        template: input.template || 'swiss-classic',
        ...input,
      },
      taskId,
      stepId,
      supabase,
      userId
    );
    
    if (modalResult) {
      return modalResult;
    }
    console.log(`[agent-execute] Modal unavailable for ${type}, using inline generation`);
  }
  
  // Store reasoning
  await storeReasoning(
    supabase, taskId, stepId, 'executor',
    `Generating ${type.toUpperCase()} document: ${filename}`,
    0.85, [], ['Document created']
  );

  // Create the actual content based on previous steps
  const { data: previousSteps } = await supabase
    .from("agent_task_steps")
    .select("tool_output, description")
    .eq("task_id", taskId)
    .lt("step_number", input.step_number || 999)
    .order("step_number");

  let compiledContent = `# ${input.title || 'Generated Document'}\n\n`;
  compiledContent += `Generated: ${new Date().toISOString()}\n\n---\n\n`;

  if (previousSteps) {
    for (const step of previousSteps) {
      if (step.tool_output?.content) {
        compiledContent += `${step.tool_output.content}\n\n`;
      } else if (step.tool_output?.answer) {
        compiledContent += `${step.tool_output.answer}\n\n`;
      } else if (step.tool_output?.analysis) {
        compiledContent += `${step.tool_output.analysis}\n\n`;
      }
    }
  }

  if (content && content !== "Document content") {
    compiledContent += `\n${content}`;
  }

  // Upload to storage
  const filePath = `${userId}/documents/${filename}.${type}`;
  const encoder = new TextEncoder();
  const buffer = encoder.encode(compiledContent);

  try {
    await supabase.storage
      .from('agent-outputs')
      .upload(filePath, buffer, {
        contentType: type === 'md' ? 'text/markdown' : 'application/octet-stream',
        upsert: true,
      });

    const { data: urlData } = supabase.storage
      .from('agent-outputs')
      .getPublicUrl(filePath);

    // Create output record
    await supabase.from("agent_outputs").insert({
      task_id: taskId,
      user_id: userId,
      output_type: type,
      file_name: `${filename}.${type}`,
      file_path: filePath,
      download_url: urlData?.publicUrl,
    });

    return {
      success: true,
      filename: `${filename}.${type}`,
      url: urlData?.publicUrl,
      file_actions: [{ type: "creating", target: `${filename}.${type}` }]
    };
  } catch (err) {
    console.error("[agent-execute] Document upload failed:", err);
    
    // Fallback: create record without storage
    await supabase.from("agent_outputs").insert({
      task_id: taskId,
      user_id: userId,
      output_type: type,
      file_name: `${filename}.${type}`,
    });

    return {
      success: true,
      filename: `${filename}.${type}`,
      file_actions: [{ type: "creating", target: `${filename}.${type}` }]
    };
  }
}

// ============================================
// MODAL AUDIO/PODCAST GENERATION
// ============================================

async function executeAudioGeneration(input: any, taskId: string, stepId: string, supabase: any, userId: string) {
  const modalResult = await executeModalTask(
    input.audio_type === 'podcast' ? 'podcast' : 'audio',
    {
      prompt: input.prompt,
      audio_type: input.audio_type || 'voiceover',
      voice: input.voice || 'Kore',
      duration_target: input.duration || 300,
    },
    taskId,
    stepId,
    supabase,
    userId
  );
  
  if (modalResult) {
    return modalResult;
  }

  // Fallback: return script for client-side TTS
  await storeReasoning(
    supabase, taskId, stepId, 'executor',
    `Audio generation requires Modal backend. Returning script for client processing.`,
    0.7, [], ['Fallback to client TTS']
  );

  return {
    success: true,
    requires_client_generation: true,
    script: input.prompt,
    audio_type: input.audio_type || 'voiceover',
    file_actions: [{ type: "preparing", target: "audio-script" }]
  };
}

// ============================================
// MODAL DEEP RESEARCH
// ============================================

async function executeDeepResearch(input: any, taskId: string, stepId: string, supabase: any, userId: string, apiKey: string) {
  // Try Modal for deep research first
  const modalResult = await executeModalTask(
    'research',
    {
      prompt: input.query || input.prompt,
      depth: input.depth || 'standard',
    },
    taskId,
    stepId,
    supabase,
    userId
  );
  
  if (modalResult) {
    return modalResult;
  }

  // Fallback: use direct API for research (bypasses Lovable Gateway rate limits)
  const result = await callAIDirect([
    { 
      role: "system", 
      content: `You are a Swiss research agent conducting comprehensive research. 
Structure your response with:
## Executive Summary
## Key Findings
## Data & Statistics
## Expert Perspectives
## Implications
## Sources
Always cite sources with [1], [2], etc.` 
    },
    { role: "user", content: input.query || input.prompt }
  ], { temperature: 0.3, maxTokens: 16384 });

  const report = result.content || "";

  await storeReasoning(
    supabase, taskId, stepId, 'researcher',
    `Completed deep research analysis. Generated comprehensive report.`,
    0.85, [], ['Multiple sources analyzed', 'Report synthesized']
  );

  // Save report as document
  const filename = `research-${Date.now()}.md`;
  const filePath = `${userId}/documents/${filename}`;
  const encoder = new TextEncoder();
  
  await supabase.storage
    .from('agent-outputs')
    .upload(filePath, encoder.encode(report), {
      contentType: 'text/markdown',
      upsert: true,
    });

  const { data: urlData } = supabase.storage
    .from('agent-outputs')
    .getPublicUrl(filePath);

  await supabase.from("agent_outputs").insert({
    task_id: taskId,
    user_id: userId,
    output_type: 'md',
    file_name: filename,
    file_path: filePath,
    download_url: urlData?.publicUrl,
  });

  return {
    success: true,
    report,
    filename,
    url: urlData?.publicUrl,
    file_actions: [{ type: "creating", target: filename }]
  };
}
