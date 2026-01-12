// supabase/functions/_shared/types/tools.ts

export interface ToolDefinition {
  name: string;
  description: string;
  category: ToolCategory;
  parameters: ToolParameters;
  capabilities: string[];
  timeout_ms: number;
  cost_credits: number;
  rate_limit: ToolRateLimit;
  idempotent: boolean;
}

export type ToolCategory =
  | 'browser'
  | 'shell'
  | 'file'
  | 'search'
  | 'document'
  | 'image'
  | 'communication'
  | 'deployment';

export interface ToolParameters {
  type: 'object';
  properties: Record<string, ToolParameterSchema>;
  required: string[];
}

export interface ToolParameterSchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: string[];
  items?: ToolParameterSchema;
  default?: unknown;
}

export interface ToolRateLimit {
  requests_per_minute: number;
  requests_per_hour: number;
  concurrent: number;
}

// 20 Core Tools
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  // Browser
  { name: 'browser_navigate', description: 'Navigate to URL', category: 'browser', timeout_ms: 30000, cost_credits: 1, rate_limit: { requests_per_minute: 30, requests_per_hour: 500, concurrent: 5 }, idempotent: true, capabilities: ['web_browsing'], parameters: { type: 'object', properties: { url: { type: 'string', description: 'URL to navigate to' } }, required: ['url'] } },
  { name: 'browser_screenshot', description: 'Take screenshot', category: 'browser', timeout_ms: 10000, cost_credits: 0.5, rate_limit: { requests_per_minute: 60, requests_per_hour: 1000, concurrent: 10 }, idempotent: true, capabilities: ['web_browsing'], parameters: { type: 'object', properties: { selector: { type: 'string', description: 'CSS selector' }, full_page: { type: 'boolean', description: 'Full page', default: false } }, required: [] } },
  { name: 'browser_click', description: 'Click element', category: 'browser', timeout_ms: 10000, cost_credits: 0.5, rate_limit: { requests_per_minute: 60, requests_per_hour: 1000, concurrent: 10 }, idempotent: false, capabilities: ['web_browsing'], parameters: { type: 'object', properties: { selector: { type: 'string', description: 'CSS selector' } }, required: ['selector'] } },
  { name: 'browser_type', description: 'Type text', category: 'browser', timeout_ms: 10000, cost_credits: 0.5, rate_limit: { requests_per_minute: 60, requests_per_hour: 1000, concurrent: 10 }, idempotent: false, capabilities: ['web_browsing'], parameters: { type: 'object', properties: { selector: { type: 'string', description: 'Input selector' }, text: { type: 'string', description: 'Text to type' } }, required: ['selector', 'text'] } },

  // Shell
  { name: 'shell_execute', description: 'Execute shell command', category: 'shell', timeout_ms: 120000, cost_credits: 2, rate_limit: { requests_per_minute: 20, requests_per_hour: 200, concurrent: 3 }, idempotent: false, capabilities: ['code_execution'], parameters: { type: 'object', properties: { command: { type: 'string', description: 'Command' }, timeout_seconds: { type: 'number', description: 'Timeout', default: 60 } }, required: ['command'] } },
  { name: 'shell_view', description: 'View terminal', category: 'shell', timeout_ms: 5000, cost_credits: 0.1, rate_limit: { requests_per_minute: 120, requests_per_hour: 2000, concurrent: 20 }, idempotent: true, capabilities: ['code_execution'], parameters: { type: 'object', properties: {}, required: [] } },

  // File
  { name: 'file_read', description: 'Read file', category: 'file', timeout_ms: 10000, cost_credits: 0.5, rate_limit: { requests_per_minute: 60, requests_per_hour: 1000, concurrent: 10 }, idempotent: true, capabilities: ['file_operations'], parameters: { type: 'object', properties: { path: { type: 'string', description: 'File path' } }, required: ['path'] } },
  { name: 'file_write', description: 'Write file', category: 'file', timeout_ms: 10000, cost_credits: 0.5, rate_limit: { requests_per_minute: 30, requests_per_hour: 500, concurrent: 5 }, idempotent: false, capabilities: ['file_operations'], parameters: { type: 'object', properties: { path: { type: 'string', description: 'File path' }, content: { type: 'string', description: 'Content' } }, required: ['path', 'content'] } },
  { name: 'file_edit', description: 'Edit file', category: 'file', timeout_ms: 10000, cost_credits: 0.5, rate_limit: { requests_per_minute: 30, requests_per_hour: 500, concurrent: 5 }, idempotent: false, capabilities: ['file_operations'], parameters: { type: 'object', properties: { path: { type: 'string', description: 'File path' }, old_str: { type: 'string', description: 'Find' }, new_str: { type: 'string', description: 'Replace' } }, required: ['path', 'old_str', 'new_str'] } },

  // Search
  { name: 'search_web', description: 'Web search', category: 'search', timeout_ms: 15000, cost_credits: 1, rate_limit: { requests_per_minute: 10, requests_per_hour: 100, concurrent: 2 }, idempotent: true, capabilities: ['web_search'], parameters: { type: 'object', properties: { query: { type: 'string', description: 'Query' }, num_results: { type: 'number', description: 'Results', default: 10 } }, required: ['query'] } },
  { name: 'search_images', description: 'Image search', category: 'search', timeout_ms: 15000, cost_credits: 1, rate_limit: { requests_per_minute: 10, requests_per_hour: 100, concurrent: 2 }, idempotent: true, capabilities: ['web_search'], parameters: { type: 'object', properties: { query: { type: 'string', description: 'Query' }, num_results: { type: 'number', description: 'Results', default: 5 } }, required: ['query'] } },

  // Document
  { name: 'generate_slides', description: 'Generate PPTX', category: 'document', timeout_ms: 120000, cost_credits: 5, rate_limit: { requests_per_minute: 5, requests_per_hour: 50, concurrent: 2 }, idempotent: false, capabilities: ['document_generation'], parameters: { type: 'object', properties: { title: { type: 'string', description: 'Title' }, slides: { type: 'array', description: 'Slides' } }, required: ['title', 'slides'] } },
  { name: 'generate_document', description: 'Generate DOCX', category: 'document', timeout_ms: 60000, cost_credits: 3, rate_limit: { requests_per_minute: 10, requests_per_hour: 100, concurrent: 3 }, idempotent: false, capabilities: ['document_generation'], parameters: { type: 'object', properties: { title: { type: 'string', description: 'Title' }, content: { type: 'string', description: 'Content' } }, required: ['title', 'content'] } },
  { name: 'generate_spreadsheet', description: 'Generate XLSX', category: 'document', timeout_ms: 60000, cost_credits: 3, rate_limit: { requests_per_minute: 10, requests_per_hour: 100, concurrent: 3 }, idempotent: false, capabilities: ['document_generation'], parameters: { type: 'object', properties: { sheets: { type: 'array', description: 'Sheets' } }, required: ['sheets'] } },

  // Image
  { name: 'generate_image', description: 'Generate image', category: 'image', timeout_ms: 30000, cost_credits: 5, rate_limit: { requests_per_minute: 5, requests_per_hour: 50, concurrent: 2 }, idempotent: true, capabilities: ['image_generation'], parameters: { type: 'object', properties: { prompt: { type: 'string', description: 'Prompt' }, size: { type: 'string', description: 'Size', default: '1024x1024' } }, required: ['prompt'] } },

  // Communication
  { name: 'send_message', description: 'Send message to user', category: 'communication', timeout_ms: 5000, cost_credits: 0, rate_limit: { requests_per_minute: 60, requests_per_hour: 500, concurrent: 10 }, idempotent: true, capabilities: [], parameters: { type: 'object', properties: { message: { type: 'string', description: 'Message' } }, required: ['message'] } },
  { name: 'ask_user', description: 'Ask user for input', category: 'communication', timeout_ms: 300000, cost_credits: 0.1, rate_limit: { requests_per_minute: 5, requests_per_hour: 50, concurrent: 1 }, idempotent: false, capabilities: [], parameters: { type: 'object', properties: { question: { type: 'string', description: 'Question' }, options: { type: 'array', description: 'Options' } }, required: ['question'] } },
  { name: 'update_plan', description: 'Update execution plan', category: 'communication', timeout_ms: 5000, cost_credits: 0, rate_limit: { requests_per_minute: 10, requests_per_hour: 100, concurrent: 5 }, idempotent: true, capabilities: [], parameters: { type: 'object', properties: { update: { type: 'string', description: 'Update' } }, required: ['update'] } },
  { name: 'complete_task', description: 'Mark task complete', category: 'communication', timeout_ms: 5000, cost_credits: 0, rate_limit: { requests_per_minute: 10, requests_per_hour: 100, concurrent: 5 }, idempotent: true, capabilities: [], parameters: { type: 'object', properties: { summary: { type: 'string', description: 'Summary' } }, required: ['summary'] } },

  // Deployment
  { name: 'deploy_preview', description: 'Deploy preview', category: 'deployment', timeout_ms: 120000, cost_credits: 3, rate_limit: { requests_per_minute: 2, requests_per_hour: 20, concurrent: 1 }, idempotent: false, capabilities: ['code_execution'], parameters: { type: 'object', properties: { project_path: { type: 'string', description: 'Path' } }, required: ['project_path'] } },
];
