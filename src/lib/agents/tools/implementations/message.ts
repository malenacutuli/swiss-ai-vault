import type { Tool, AgentContext, ToolResult } from '../types';
import { messageInfoSchema, messageAskSchema } from '../schemas/message';
import { supabase } from '@/integrations/supabase/client';

// message.info - Send info to user
export const messageInfo: Tool = {
  name: 'message.info',
  description: 'Send an informational message to the user. Supports different severity levels and action buttons.',
  category: 'message',
  schema: messageInfoSchema,
  safety: 'safe',
  rateLimit: { requests: 50, windowMs: 60000 },
  requiresConfirmation: false,
  execute: async (params: unknown, context: AgentContext): Promise<ToolResult> => {
    const validated = messageInfoSchema.parse(params);
    const startTime = Date.now();
    
    console.log('[message.info] Sending message:', validated.level, validated.title || '(no title)');
    
    try {
      // Log the message to the task logs for display in UI
      await supabase.from('agent_task_logs').insert({
        task_id: context.taskId,
        log_type: validated.level || 'info',
        content: validated.title 
          ? `**${validated.title}**\n${validated.content}`
          : validated.content,
        metadata: {
          actions: validated.actions,
          persistent: validated.persistent,
        },
      });
      
      // Also insert as an agent message for structured access
      await supabase.from('agent_messages').insert({
        task_id: context.taskId,
        sender: 'agent',
        sender_role: 'assistant',
        message_type: validated.level || 'info',
        payload: {
          title: validated.title,
          content: validated.content,
          actions: validated.actions,
          persistent: validated.persistent,
        },
      });
      
      const durationMs = Date.now() - startTime;
      
      return {
        success: true,
        output: {
          level: validated.level || 'info',
          title: validated.title,
          content: validated.content,
          delivered: true,
        },
        durationMs,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to send message',
        durationMs: Date.now() - startTime,
      };
    }
  },
};

// message.ask - Ask user a question
export const messageAsk: Tool = {
  name: 'message.ask',
  description: 'Ask the user a question and wait for their response. Supports text, confirm, and choice types.',
  category: 'message',
  schema: messageAskSchema,
  safety: 'safe',
  rateLimit: { requests: 20, windowMs: 60000 },
  requiresConfirmation: false,
  execute: async (params: unknown, context: AgentContext): Promise<ToolResult> => {
    const validated = messageAskSchema.parse(params);
    const startTime = Date.now();
    
    console.log('[message.ask] Asking user:', validated.type, validated.question.substring(0, 50));
    
    try {
      // Create a pending message that waits for user response
      const { data: message, error } = await supabase
        .from('agent_messages')
        .insert({
          task_id: context.taskId,
          sender: 'agent',
          sender_role: 'assistant',
          message_type: 'question',
          payload: {
            question: validated.question,
            type: validated.type || 'text',
            choices: validated.choices,
            defaultValue: validated.defaultValue,
            placeholder: validated.placeholder,
            validation: validated.validation,
          },
          priority: 'high',
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      // Log to task logs for UI display
      await supabase.from('agent_task_logs').insert({
        task_id: context.taskId,
        log_type: 'question',
        content: `❓ ${validated.question}`,
        metadata: {
          messageId: message?.id,
          type: validated.type,
          choices: validated.choices,
        },
      });
      
      // Update task to indicate waiting for user input
      await supabase
        .from('agent_tasks')
        .update({
          status: 'waiting_input',
          updated_at: new Date().toISOString(),
        })
        .eq('id', context.taskId);
      
      const durationMs = Date.now() - startTime;
      
      return {
        success: true,
        output: {
          question: validated.question,
          type: validated.type || 'text',
          messageId: message?.id,
          awaiting: true,
          timeout: validated.timeout || 120000,
        },
        durationMs,
        metadata: {
          requiresUserResponse: true,
          messageId: message?.id,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to ask question',
        durationMs: Date.now() - startTime,
      };
    }
  },
};
