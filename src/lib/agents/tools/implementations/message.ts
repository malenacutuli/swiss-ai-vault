import type { Tool, AgentContext, ToolResult } from '../types';
import { messageInfoSchema, messageAskSchema } from '../schemas/message';

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
    
    console.log('[message.info] Sending message:', validated.level, validated.title || '(no title)');
    
    return {
      success: true,
      output: {
        level: validated.level,
        title: validated.title,
        content: validated.content,
        delivered: true,
      },
    };
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
    
    console.log('[message.ask] Asking user:', validated.type, validated.question.substring(0, 50));
    
    // In a real implementation, this would wait for user input
    return {
      success: true,
      output: {
        question: validated.question,
        type: validated.type,
        awaiting: true,
        timeout: validated.timeout,
      },
    };
  },
};
