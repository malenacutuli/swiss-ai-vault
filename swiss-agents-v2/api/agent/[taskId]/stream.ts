/**
 * GET /api/agent/[taskId]/stream
 * Server-Sent Events stream for real-time task updates
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Manus API client (inline for serverless)
async function* streamManusCompletion(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  tools: any[]
): AsyncGenerator<any, void, unknown> {
  const response = await fetch('https://api.manus.im/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'manus-1.6-max',
      messages,
      tools,
      tool_choice: 'auto',
      max_tokens: 4096,
      temperature: 0.7,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Manus API error: ${response.status}`);
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data: ')) {
          try {
            yield JSON.parse(trimmed.slice(6));
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// Tool definitions (simplified)
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'plan',
      description: 'Create or update the execution plan',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['update', 'advance'] },
          goal: { type: 'string' },
          phases: { type: 'array' },
          current_phase_id: { type: 'number' },
          next_phase_id: { type: 'number' },
        },
        required: ['action', 'current_phase_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'message',
      description: 'Send a message to the user',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['info', 'ask', 'result'] },
          text: { type: 'string' },
          attachments: { type: 'array', items: { type: 'string' } },
        },
        required: ['type', 'text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'shell',
      description: 'Execute shell commands',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['exec', 'view', 'wait', 'send', 'kill'] },
          session: { type: 'string' },
          command: { type: 'string' },
          brief: { type: 'string' },
        },
        required: ['action', 'session', 'brief'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'file',
      description: 'Read, write, or edit files',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['view', 'read', 'write', 'append', 'edit'] },
          path: { type: 'string' },
          text: { type: 'string' },
          brief: { type: 'string' },
        },
        required: ['action', 'path', 'brief'],
      },
    },
  },
];

const SYSTEM_PROMPT = `You are an autonomous AI agent. Complete tasks through iterative planning and execution.

Rules:
1. Always start with the 'plan' tool to create an execution plan
2. Use tools one at a time to make progress
3. Use 'message' with type 'result' to deliver final results
4. Never skip phases in the plan

Respond with exactly one tool call per turn.`;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Only allow GET
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { taskId } = req.query;

  if (!taskId || typeof taskId !== 'string') {
    res.status(400).json({ error: 'taskId is required' });
    return;
  }

  // Validate environment
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const manusApiKey = process.env.MANUS_API_KEY;

  if (!supabaseUrl || !supabaseKey || !manusApiKey) {
    res.status(500).json({ error: 'Server not configured' });
    return;
  }

  // Initialize Supabase
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get task
  const { data: task, error: taskError } = await supabase
    .from('agent_tasks_v2')
    .select('*')
    .eq('id', taskId)
    .single();

  if (taskError || !task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Helper to send SSE events
  const sendEvent = (type: string, data: any) => {
    res.write(`event: ${type}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Send initial event
  sendEvent('task_started', {
    taskId,
    prompt: task.prompt,
    state: 'planning',
  });

  // Update task state
  await supabase
    .from('agent_tasks_v2')
    .update({ state: 'planning', updated_at: new Date().toISOString() })
    .eq('id', taskId);

  // Initialize conversation
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: task.prompt },
  ];

  let iteration = 0;
  const maxIterations = task.options?.maxIterations || 30;
  let isComplete = false;

  try {
    while (iteration < maxIterations && !isComplete) {
      iteration++;

      sendEvent('thinking', { iteration, content: 'Analyzing and determining next action...' });

      // Call Manus API (non-streaming for simplicity in this version)
      const response = await fetch('https://api.manus.im/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${manusApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'manus-1.6-max',
          messages,
          tools: TOOLS,
          tool_choice: 'auto',
          max_tokens: 4096,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Manus API error: ${response.status} - ${errorText}`);
      }

      const completion = await response.json();
      const choice = completion.choices?.[0];

      if (!choice) {
        throw new Error('No response from Manus API');
      }

      // Handle tool calls
      if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        const toolCall = choice.message.tool_calls[0];
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        sendEvent('tool_started', { toolName, toolInput: toolArgs });

        // Execute tool (simplified)
        let toolResult = '';

        switch (toolName) {
          case 'plan':
            if (toolArgs.action === 'update') {
              const plan = {
                goal: toolArgs.goal,
                phases: toolArgs.phases || [],
              };
              await supabase
                .from('agent_tasks_v2')
                .update({
                  plan,
                  current_phase_id: toolArgs.current_phase_id,
                  state: 'executing',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', taskId);

              sendEvent('plan_created', { plan });
              toolResult = `Plan created with ${plan.phases.length} phases`;
            } else if (toolArgs.action === 'advance') {
              await supabase
                .from('agent_tasks_v2')
                .update({
                  current_phase_id: toolArgs.next_phase_id,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', taskId);

              sendEvent('phase_completed', { phaseId: toolArgs.current_phase_id });
              sendEvent('phase_started', { phaseId: toolArgs.next_phase_id });
              toolResult = `Advanced to phase ${toolArgs.next_phase_id}`;
            }
            break;

          case 'message':
            sendEvent('message', {
              role: 'assistant',
              content: toolArgs.text,
              messageType: toolArgs.type,
            });

            if (toolArgs.type === 'result') {
              await supabase
                .from('agent_tasks_v2')
                .update({
                  state: 'completed',
                  result: { message: toolArgs.text, attachments: toolArgs.attachments || [] },
                  completed_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', taskId);

              sendEvent('task_completed', {
                result: { message: toolArgs.text, attachments: toolArgs.attachments || [] },
              });
              isComplete = true;
            }
            toolResult = `Message sent (${toolArgs.type})`;
            break;

          case 'shell':
            sendEvent('tool_output', {
              toolName: 'shell',
              output: `[Executing: ${toolArgs.command || toolArgs.action}]`,
              isPartial: false,
            });
            toolResult = `Shell ${toolArgs.action}: ${toolArgs.command || 'completed'}`;
            break;

          case 'file':
            sendEvent('tool_output', {
              toolName: 'file',
              output: `[File ${toolArgs.action}: ${toolArgs.path}]`,
              isPartial: false,
            });
            toolResult = `File ${toolArgs.action} on ${toolArgs.path}`;
            break;

          default:
            toolResult = `Tool ${toolName} executed`;
        }

        sendEvent('tool_completed', { toolName, success: true, output: toolResult });

        // Add to conversation
        messages.push({
          role: 'assistant',
          content: JSON.stringify({ tool_call: toolName, args: toolArgs }),
        });
        messages.push({
          role: 'user',
          content: `Tool result: ${toolResult}`,
        });

      } else if (choice.message.content) {
        // Text response (shouldn't happen often with tool_choice: auto)
        sendEvent('message', {
          role: 'assistant',
          content: choice.message.content,
        });
        messages.push({
          role: 'assistant',
          content: choice.message.content,
        });
      }

      // Small delay to prevent tight loops
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!isComplete) {
      sendEvent('task_failed', { error: 'Maximum iterations reached' });
      await supabase
        .from('agent_tasks_v2')
        .update({
          state: 'failed',
          error: 'Maximum iterations reached',
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    sendEvent('task_failed', { error: errorMessage });
    
    await supabase
      .from('agent_tasks_v2')
      .update({
        state: 'failed',
        error: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);
  }

  // End stream
  sendEvent('stream_end', { taskId });
  res.end();
}
