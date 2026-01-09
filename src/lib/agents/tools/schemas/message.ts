import { z } from 'zod';

// message.info - Send info to user
export const messageInfoSchema = z.object({
  content: z.string().min(1).max(10000).describe('Message content to display'),
  level: z.enum(['info', 'success', 'warning', 'error']).optional().default('info').describe('Message severity level'),
  title: z.string().max(200).optional().describe('Optional message title'),
  actions: z.array(z.object({
    label: z.string().max(50).describe('Button label'),
    action: z.string().max(100).describe('Action identifier'),
  })).max(4).optional().describe('Optional action buttons'),
  persistent: z.boolean().optional().default(false).describe('Keep message visible until dismissed'),
});

export type MessageInfoParams = z.infer<typeof messageInfoSchema>;

// message.ask - Ask user a question
export const messageAskSchema = z.object({
  question: z.string().min(1).max(2000).describe('Question to ask the user'),
  type: z.enum(['text', 'confirm', 'choice', 'multiChoice']).optional().default('text').describe('Type of response expected'),
  choices: z.array(z.object({
    value: z.string().max(100).describe('Choice value'),
    label: z.string().max(200).describe('Choice display label'),
    description: z.string().max(500).optional().describe('Optional description'),
  })).max(10).optional().describe('Choices for choice/multiChoice type'),
  defaultValue: z.union([z.string(), z.boolean(), z.array(z.string())]).optional().describe('Default value'),
  placeholder: z.string().max(200).optional().describe('Placeholder text for text input'),
  validation: z.object({
    required: z.boolean().optional().default(true),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    pattern: z.string().optional(),
  }).optional().describe('Validation rules for text input'),
  timeout: z.number().min(5000).max(600000).optional().default(120000).describe('Response timeout in milliseconds'),
});

export type MessageAskParams = z.infer<typeof messageAskSchema>;
