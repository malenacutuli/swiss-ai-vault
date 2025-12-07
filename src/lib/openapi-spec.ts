export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'SwissVault.ai API',
    description: `
# SwissVault.ai API

Enterprise-grade AI infrastructure with Swiss data residency. Build, fine-tune, and deploy custom AI models with complete data sovereignty.

## Authentication

All API requests require authentication using an API key. Include your API key in the \`Authorization\` header:

\`\`\`
Authorization: Bearer sv_your_api_key
\`\`\`

You can generate API keys from your [Dashboard Settings](/dashboard/settings).

## Rate Limits

- **Standard tier**: 100 requests/minute
- **Professional tier**: 1,000 requests/minute
- **Enterprise tier**: Custom limits

## Base URL

All API requests should be made to:

\`\`\`
https://rljnrgscmosgkcjdvlrq.supabase.co
\`\`\`
    `,
    version: '1.0.0',
    contact: {
      name: 'SwissVault.ai Support',
      email: 'malena@axessible.ai',
      url: 'https://swissvault.ai',
    },
    license: {
      name: 'Proprietary',
      url: 'https://swissvault.ai/terms',
    },
  },
  servers: [
    {
      url: 'https://rljnrgscmosgkcjdvlrq.supabase.co',
      description: 'Production Server',
    },
  ],
  tags: [
    {
      name: 'Chat Completions',
      description: 'Generate AI responses using OpenAI-compatible format',
    },
    {
      name: 'Fine-tuning',
      description: 'Create and manage fine-tuning jobs',
    },
    {
      name: 'Evaluations',
      description: 'Run model evaluations with custom metrics',
    },
    {
      name: 'Datasets',
      description: 'Manage training datasets and synthetic data generation',
    },
    {
      name: 'Documents',
      description: 'Embed documents for RAG (Retrieval-Augmented Generation)',
    },
  ],
  paths: {
    '/functions/v1/chat-completions': {
      post: {
        tags: ['Chat Completions'],
        summary: 'Create Chat Completion',
        description: 'Generate a chat completion using OpenAI-compatible format. Supports base models (GPT-4, Claude, Gemini) and your fine-tuned models.',
        operationId: 'createChatCompletion',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ChatCompletionRequest',
              },
              examples: {
                basic: {
                  summary: 'Basic request',
                  value: {
                    model: 'gpt-4o-mini',
                    messages: [
                      { role: 'system', content: 'You are a helpful assistant.' },
                      { role: 'user', content: 'Hello!' },
                    ],
                  },
                },
                withOptions: {
                  summary: 'With options',
                  value: {
                    model: 'claude-3-5-sonnet',
                    messages: [
                      { role: 'user', content: 'Explain quantum computing.' },
                    ],
                    temperature: 0.7,
                    max_tokens: 1024,
                    stream: false,
                  },
                },
                fineTuned: {
                  summary: 'Fine-tuned model',
                  value: {
                    model: 'sv-my-custom-model',
                    messages: [
                      { role: 'user', content: 'Analyze this contract clause...' },
                    ],
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ChatCompletionResponse',
                },
              },
            },
          },
          '400': {
            description: 'Bad Request',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized - Invalid or missing API key',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '402': {
            description: 'Payment Required - Insufficient credits',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Too Many Requests - Rate limit exceeded',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/functions/v1/start-finetuning': {
      post: {
        tags: ['Fine-tuning'],
        summary: 'Start Fine-tuning Job',
        description: 'Start training for a pending fine-tuning job. This initiates the GPU training process on our infrastructure.',
        operationId: 'startFinetuning',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['job_id'],
                properties: {
                  job_id: {
                    type: 'string',
                    format: 'uuid',
                    description: 'The fine-tuning job ID to start',
                    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Job started successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    message: {
                      type: 'string',
                      example: 'Fine-tuning job started successfully',
                    },
                    job_id: {
                      type: 'string',
                      format: 'uuid',
                    },
                    experiment_id: {
                      type: 'string',
                      format: 'uuid',
                    },
                    call_id: {
                      type: 'string',
                      description: 'External worker call ID',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Bad Request - Job not in pending status',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '402': {
            description: 'Payment Required - Insufficient credits',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '404': {
            description: 'Not Found - Job not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/functions/v1/run-evaluation': {
      post: {
        tags: ['Evaluations'],
        summary: 'Run Model Evaluation',
        description: 'Execute an evaluation run against a model using selected metrics. Supports LLM-as-Judge, string matching, and custom metrics.',
        operationId: 'runEvaluation',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['evaluation_id'],
                properties: {
                  evaluation_id: {
                    type: 'string',
                    format: 'uuid',
                    description: 'The evaluation ID to run',
                    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Evaluation completed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    evaluation_id: {
                      type: 'string',
                      format: 'uuid',
                    },
                    results: {
                      type: 'object',
                      additionalProperties: {
                        type: 'object',
                        properties: {
                          avg: { type: 'number', example: 0.85 },
                          min: { type: 'number', example: 0.60 },
                          max: { type: 'number', example: 1.00 },
                          count: { type: 'integer', example: 50 },
                        },
                      },
                    },
                    detailed_results: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          sample_index: { type: 'integer' },
                          input: { type: 'string' },
                          expected: { type: 'string' },
                          prediction: { type: 'string' },
                          scores: { type: 'object' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Evaluation not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/functions/v1/generate-synthetic': {
      post: {
        tags: ['Datasets'],
        summary: 'Generate Synthetic Data',
        description: 'Generate synthetic QA pairs from source content using AI. Creates training-ready JSONL format data.',
        operationId: 'generateSynthetic',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['dataset_id', 'source_content'],
                properties: {
                  dataset_id: {
                    type: 'string',
                    format: 'uuid',
                    description: 'Target dataset ID',
                  },
                  source_content: {
                    type: 'string',
                    description: 'Source text or URL to generate QA pairs from',
                    example: 'https://example.com/docs or raw text content',
                  },
                  source_type: {
                    type: 'string',
                    enum: ['text', 'url'],
                    default: 'text',
                    description: 'Type of source content',
                  },
                  num_pairs: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 100,
                    default: 10,
                    description: 'Number of QA pairs to generate',
                  },
                  style: {
                    type: 'string',
                    enum: ['factual', 'conversational', 'technical', 'creative'],
                    default: 'factual',
                    description: 'Style of generated content',
                  },
                  language: {
                    type: 'string',
                    default: 'en',
                    description: 'Target language code',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Synthetic data generated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    dataset_id: {
                      type: 'string',
                      format: 'uuid',
                    },
                    pairs_generated: {
                      type: 'integer',
                      example: 10,
                    },
                    snapshot_id: {
                      type: 'string',
                      format: 'uuid',
                      description: 'ID of the created dataset snapshot',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Bad Request - Invalid source content',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/functions/v1/embed-document': {
      post: {
        tags: ['Documents'],
        summary: 'Embed Document for RAG',
        description: 'Process and embed a document for use in Retrieval-Augmented Generation. Supports PDF, DOCX, PPTX, TXT, and MD files up to 500MB.',
        operationId: 'embedDocument',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: {
                    type: 'string',
                    format: 'binary',
                    description: 'Document file to embed (PDF, DOCX, PPTX, TXT, MD)',
                  },
                  conversation_id: {
                    type: 'string',
                    format: 'uuid',
                    description: 'Optional conversation ID to scope the embeddings',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Document embedded successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    chunks_created: {
                      type: 'integer',
                      description: 'Number of text chunks created and embedded',
                      example: 42,
                    },
                    total_tokens: {
                      type: 'integer',
                      description: 'Total tokens processed',
                      example: 15420,
                    },
                    file_info: {
                      type: 'object',
                      properties: {
                        filename: { type: 'string' },
                        size_bytes: { type: 'integer' },
                        type: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Bad Request - Unsupported file format or file too large',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/functions/v1/process-dataset': {
      post: {
        tags: ['Datasets'],
        summary: 'Process Dataset',
        description: 'Validate and process a JSONL dataset file. Counts tokens, validates format, and creates dataset snapshot.',
        operationId: 'processDataset',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['dataset_id'],
                properties: {
                  dataset_id: {
                    type: 'string',
                    format: 'uuid',
                    description: 'Dataset ID to process',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Dataset processed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    dataset_id: {
                      type: 'string',
                      format: 'uuid',
                    },
                    row_count: {
                      type: 'integer',
                      example: 1000,
                    },
                    total_tokens: {
                      type: 'integer',
                      example: 250000,
                    },
                    status: {
                      type: 'string',
                      enum: ['ready', 'error'],
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'API Key',
        description: 'Use your SwissVault API key (starts with sv_ or svk_)',
      },
    },
    schemas: {
      ChatCompletionRequest: {
        type: 'object',
        required: ['model', 'messages'],
        properties: {
          model: {
            type: 'string',
            description: 'Model ID or your fine-tuned model ID',
            example: 'gpt-4o-mini',
            enum: [
              'gpt-4o',
              'gpt-4o-mini',
              'claude-3-5-sonnet',
              'claude-3-5-haiku',
              'qwen2.5-1.5b',
              'qwen2.5-7b',
              'qwen2.5-coder-7b',
              'mistral-7b',
              'llama3.2-1b',
              'llama3.2-3b',
            ],
          },
          messages: {
            type: 'array',
            description: 'Conversation history',
            items: {
              $ref: '#/components/schemas/Message',
            },
          },
          temperature: {
            type: 'number',
            minimum: 0,
            maximum: 2,
            default: 1,
            description: 'Sampling temperature (0-2)',
          },
          max_tokens: {
            type: 'integer',
            minimum: 1,
            maximum: 128000,
            default: 1024,
            description: 'Maximum response tokens',
          },
          stream: {
            type: 'boolean',
            default: false,
            description: 'Stream response as Server-Sent Events',
          },
          top_p: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            default: 1,
            description: 'Nucleus sampling probability',
          },
          frequency_penalty: {
            type: 'number',
            minimum: -2,
            maximum: 2,
            default: 0,
            description: 'Frequency penalty for token repetition',
          },
          presence_penalty: {
            type: 'number',
            minimum: -2,
            maximum: 2,
            default: 0,
            description: 'Presence penalty for new topics',
          },
        },
      },
      Message: {
        type: 'object',
        required: ['role', 'content'],
        properties: {
          role: {
            type: 'string',
            enum: ['system', 'user', 'assistant'],
            description: 'Message role',
          },
          content: {
            type: 'string',
            description: 'Message content',
          },
        },
      },
      ChatCompletionResponse: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Unique completion ID',
            example: 'chatcmpl-abc123',
          },
          object: {
            type: 'string',
            enum: ['chat.completion'],
          },
          created: {
            type: 'integer',
            description: 'Unix timestamp',
            example: 1705320000,
          },
          model: {
            type: 'string',
            description: 'Model used',
            example: 'gpt-4o-mini',
          },
          choices: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                index: {
                  type: 'integer',
                },
                message: {
                  $ref: '#/components/schemas/Message',
                },
                finish_reason: {
                  type: 'string',
                  enum: ['stop', 'length', 'content_filter'],
                },
              },
            },
          },
          usage: {
            type: 'object',
            properties: {
              prompt_tokens: {
                type: 'integer',
                example: 25,
              },
              completion_tokens: {
                type: 'integer',
                example: 50,
              },
              total_tokens: {
                type: 'integer',
                example: 75,
              },
            },
          },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'Error message',
              },
              type: {
                type: 'string',
                description: 'Error type',
              },
              code: {
                type: 'string',
                description: 'Error code',
              },
            },
          },
        },
      },
    },
  },
};

// Helper functions for export
export const getOpenApiJson = () => JSON.stringify(openApiSpec, null, 2);

export const getOpenApiYaml = () => {
  // Simple YAML conversion for basic structures
  const toYaml = (obj: unknown, indent = 0): string => {
    const spaces = '  '.repeat(indent);
    
    if (obj === null || obj === undefined) return 'null';
    if (typeof obj === 'boolean') return obj ? 'true' : 'false';
    if (typeof obj === 'number') return String(obj);
    if (typeof obj === 'string') {
      if (obj.includes('\n') || obj.includes(':') || obj.includes('#')) {
        return `|\n${obj.split('\n').map(line => spaces + '  ' + line).join('\n')}`;
      }
      return obj.includes('"') ? `'${obj}'` : obj;
    }
    
    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]';
      return obj.map(item => {
        const itemYaml = toYaml(item, indent + 1);
        if (typeof item === 'object' && item !== null) {
          return `${spaces}- ${itemYaml.trim().replace(/^\s+/, '').replace(/\n/g, '\n' + spaces + '  ')}`;
        }
        return `${spaces}- ${itemYaml}`;
      }).join('\n');
    }
    
    if (typeof obj === 'object') {
      const entries = Object.entries(obj as Record<string, unknown>);
      if (entries.length === 0) return '{}';
      return entries.map(([key, value]) => {
        const valueYaml = toYaml(value, indent + 1);
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          return `${spaces}${key}:\n${valueYaml}`;
        }
        if (Array.isArray(value) && value.length > 0) {
          return `${spaces}${key}:\n${valueYaml}`;
        }
        return `${spaces}${key}: ${valueYaml}`;
      }).join('\n');
    }
    
    return String(obj);
  };
  
  return toYaml(openApiSpec);
};
