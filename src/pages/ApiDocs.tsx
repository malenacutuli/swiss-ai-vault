import { useState, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Copy, 
  Check, 
  Key, 
  MessageSquare, 
  Database, 
  SlidersHorizontal, 
  BarChart3, 
  Cpu,
  ChevronRight,
  ExternalLink,
  Play,
  ArrowLeft,
  Download,
  FileJson,
  FileCode,
  Zap
} from 'lucide-react';
import { SwissFlag } from '@/components/icons/SwissFlag';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getOpenApiJson, getOpenApiYaml } from '@/lib/openapi-spec';

const SwaggerUIWrapper = lazy(() => 
  import('@/components/api-docs/SwaggerUIWrapper').then(m => ({ default: m.SwaggerUIWrapper }))
);

interface Endpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  title: string;
  description: string;
  auth: boolean;
  parameters?: Parameter[];
  requestBody?: string;
  responseBody?: string;
  curlExample: string;
  pythonExample: string;
  jsExample: string;
  responseExample: string;
  errorCodes?: ErrorCode[];
}

interface Parameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface ErrorCode {
  code: number;
  message: string;
  description: string;
}

interface Category {
  id: string;
  name: string;
  icon: typeof Key;
  endpoints: Endpoint[];
}

const categories: Category[] = [
  {
    id: 'auth',
    name: 'Authentication',
    icon: Key,
    endpoints: [
      {
        id: 'auth-overview',
        method: 'GET',
        path: '/rest/v1/api_keys',
        title: 'List API Keys',
        description: 'Retrieve all API keys associated with your account. API keys are used to authenticate requests to the SwissVault.ai API.',
        auth: true,
        parameters: [
          { name: 'select', type: 'string', required: false, description: 'Columns to return (e.g., "id,name,key_prefix")' },
        ],
        requestBody: undefined,
        responseBody: `[
  {
    "id": "uuid",
    "name": "Production Key",
    "key_prefix": "sv_abc123...",
    "permissions": ["read", "write"],
    "created_at": "2024-01-15T10:30:00Z",
    "last_used_at": "2024-01-20T14:22:00Z"
  }
]`,
        curlExample: `curl -X GET "https://rljnrgscmosgkcjdvlrq.supabase.co/rest/v1/api_keys" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "apikey: YOUR_ANON_KEY"`,
        pythonExample: `import requests

response = requests.get(
    "https://rljnrgscmosgkcjdvlrq.supabase.co/rest/v1/api_keys",
    headers={
        "Authorization": "Bearer YOUR_API_KEY",
        "apikey": "YOUR_ANON_KEY"
    }
)
print(response.json())`,
        jsExample: `const response = await fetch(
  "https://rljnrgscmosgkcjdvlrq.supabase.co/rest/v1/api_keys",
  {
    headers: {
      "Authorization": "Bearer YOUR_API_KEY",
      "apikey": "YOUR_ANON_KEY"
    }
  }
);
const data = await response.json();`,
        responseExample: `[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Production API Key",
    "key_prefix": "sv_abc123...",
    "permissions": ["read", "write"],
    "created_at": "2024-01-15T10:30:00Z"
  }
]`,
        errorCodes: [
          { code: 401, message: 'Unauthorized', description: 'Invalid or missing API key' },
          { code: 403, message: 'Forbidden', description: 'Insufficient permissions' },
        ],
      },
    ],
  },
  {
    id: 'chat',
    name: 'Chat Completions',
    icon: MessageSquare,
    endpoints: [
      {
        id: 'chat-completions',
        method: 'POST',
        path: '/functions/v1/chat-completions',
        title: 'Create Chat Completion',
        description: 'Generate a chat completion using OpenAI-compatible format. Supports base models (GPT-4, Claude, Gemini) and your fine-tuned models.',
        auth: true,
        parameters: [],
        requestBody: `{
  "model": "gpt-4o-mini",           // Model ID or your fine-tuned model ID
  "messages": [                      // Conversation history
    {
      "role": "system",              // "system", "user", or "assistant"
      "content": "You are a helpful assistant."
    },
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "temperature": 0.7,                // Optional: 0-2, default 1
  "max_tokens": 1024,                // Optional: max response tokens
  "stream": false                    // Optional: stream response
}`,
        responseBody: `{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1705320000,
  "model": "gpt-4o-mini",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! I'm doing well, thank you..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 50,
    "total_tokens": 75
  }
}`,
        curlExample: `curl -X POST "https://rljnrgscmosgkcjdvlrq.supabase.co/functions/v1/chat-completions" \\
  -H "Authorization: Bearer sv_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'`,
        pythonExample: `import requests

response = requests.post(
    "https://rljnrgscmosgkcjdvlrq.supabase.co/functions/v1/chat-completions",
    headers={
        "Authorization": "Bearer sv_your_api_key",
        "Content-Type": "application/json"
    },
    json={
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "user", "content": "Hello!"}
        ]
    }
)
print(response.json())`,
        jsExample: `const response = await fetch(
  "https://rljnrgscmosgkcjdvlrq.supabase.co/functions/v1/chat-completions",
  {
    method: "POST",
    headers: {
      "Authorization": "Bearer sv_your_api_key",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "user", content: "Hello!" }
      ]
    })
  }
);
const data = await response.json();`,
        responseExample: `{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1705320000,
  "model": "gpt-4o-mini",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I assist you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 12,
    "total_tokens": 22
  }
}`,
        errorCodes: [
          { code: 400, message: 'Bad Request', description: 'Invalid request body or parameters' },
          { code: 401, message: 'Unauthorized', description: 'Invalid or missing API key' },
          { code: 402, message: 'Payment Required', description: 'Insufficient credits' },
          { code: 429, message: 'Too Many Requests', description: 'Rate limit exceeded' },
          { code: 500, message: 'Internal Error', description: 'Model inference failed' },
        ],
      },
    ],
  },
  {
    id: 'finetuning',
    name: 'Fine-tuning',
    icon: SlidersHorizontal,
    endpoints: [
      {
        id: 'create-job',
        method: 'POST',
        path: '/rest/v1/finetuning_jobs',
        title: 'Create Fine-tuning Job',
        description: 'Create a new fine-tuning job. The job will be queued for training once created.',
        auth: true,
        parameters: [],
        requestBody: `{
  "name": "My Fine-tuned Model",        // Job name
  "base_model": "Qwen/Qwen2.5-1.5B",    // Base model to fine-tune
  "snapshot_id": "uuid",                 // Dataset snapshot ID
  "method": "lora",                      // "lora", "qlora", or "full"
  "hyperparameters": {
    "epochs": 3,
    "batch_size": 4,
    "learning_rate": 0.0002,
    "lora_r": 16,
    "lora_alpha": 32,
    "warmup_ratio": 0.03
  }
}`,
        responseBody: `{
  "id": "uuid",
  "name": "My Fine-tuned Model",
  "status": "pending",
  "base_model": "Qwen/Qwen2.5-1.5B",
  "created_at": "2024-01-15T10:30:00Z"
}`,
        curlExample: `curl -X POST "https://rljnrgscmosgkcjdvlrq.supabase.co/rest/v1/finetuning_jobs" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "apikey: YOUR_ANON_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "My Model",
    "base_model": "Qwen/Qwen2.5-1.5B",
    "snapshot_id": "your-snapshot-id",
    "method": "lora"
  }'`,
        pythonExample: `import requests

response = requests.post(
    "https://rljnrgscmosgkcjdvlrq.supabase.co/rest/v1/finetuning_jobs",
    headers={
        "Authorization": "Bearer YOUR_API_KEY",
        "apikey": "YOUR_ANON_KEY",
        "Content-Type": "application/json"
    },
    json={
        "name": "My Model",
        "base_model": "Qwen/Qwen2.5-1.5B",
        "snapshot_id": "your-snapshot-id",
        "method": "lora"
    }
)`,
        jsExample: `const response = await fetch(
  "https://rljnrgscmosgkcjdvlrq.supabase.co/rest/v1/finetuning_jobs",
  {
    method: "POST",
    headers: {
      "Authorization": "Bearer YOUR_API_KEY",
      "apikey": "YOUR_ANON_KEY",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "My Model",
      base_model: "Qwen/Qwen2.5-1.5B",
      snapshot_id: "your-snapshot-id",
      method: "lora"
    })
  }
);`,
        responseExample: `{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "My Model",
  "status": "pending",
  "base_model": "Qwen/Qwen2.5-1.5B",
  "method": "lora",
  "created_at": "2024-01-15T10:30:00Z"
}`,
        errorCodes: [
          { code: 400, message: 'Bad Request', description: 'Invalid parameters or missing required fields' },
          { code: 402, message: 'Payment Required', description: 'Insufficient credits for fine-tuning' },
        ],
      },
      {
        id: 'list-jobs',
        method: 'GET',
        path: '/rest/v1/finetuning_jobs',
        title: 'List Fine-tuning Jobs',
        description: 'Retrieve all fine-tuning jobs for your account.',
        auth: true,
        parameters: [
          { name: 'select', type: 'string', required: false, description: 'Columns to return' },
          { name: 'status', type: 'string', required: false, description: 'Filter by status (pending, training, completed, failed)' },
          { name: 'order', type: 'string', required: false, description: 'Sort order (e.g., "created_at.desc")' },
        ],
        requestBody: undefined,
        responseBody: `[
  {
    "id": "uuid",
    "name": "string",
    "status": "pending|queued|training|completed|failed",
    "base_model": "string",
    "method": "lora|qlora|full",
    "created_at": "timestamp",
    "started_at": "timestamp|null",
    "completed_at": "timestamp|null"
  }
]`,
        curlExample: `curl -X GET "https://rljnrgscmosgkcjdvlrq.supabase.co/rest/v1/finetuning_jobs?order=created_at.desc" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "apikey: YOUR_ANON_KEY"`,
        pythonExample: `import requests

response = requests.get(
    "https://rljnrgscmosgkcjdvlrq.supabase.co/rest/v1/finetuning_jobs",
    headers={
        "Authorization": "Bearer YOUR_API_KEY",
        "apikey": "YOUR_ANON_KEY"
    },
    params={"order": "created_at.desc"}
)`,
        jsExample: `const response = await fetch(
  "https://rljnrgscmosgkcjdvlrq.supabase.co/rest/v1/finetuning_jobs?order=created_at.desc",
  {
    headers: {
      "Authorization": "Bearer YOUR_API_KEY",
      "apikey": "YOUR_ANON_KEY"
    }
  }
);`,
        responseExample: `[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Customer Support Bot",
    "status": "completed",
    "base_model": "Qwen/Qwen2.5-1.5B",
    "method": "lora",
    "created_at": "2024-01-15T10:30:00Z",
    "completed_at": "2024-01-15T12:45:00Z"
  }
]`,
        errorCodes: [
          { code: 401, message: 'Unauthorized', description: 'Invalid or missing API key' },
        ],
      },
      {
        id: 'start-training',
        method: 'POST',
        path: '/functions/v1/start-finetuning',
        title: 'Start Training',
        description: 'Start training for a pending fine-tuning job. This initiates the GPU training process.',
        auth: true,
        parameters: [],
        requestBody: `{
  "job_id": "uuid"    // The fine-tuning job ID to start
}`,
        responseBody: `{
  "success": true,
  "message": "Fine-tuning job started",
  "job_id": "uuid",
  "experiment_id": "uuid"
}`,
        curlExample: `curl -X POST "https://rljnrgscmosgkcjdvlrq.supabase.co/functions/v1/start-finetuning" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"job_id": "your-job-id"}'`,
        pythonExample: `import requests

response = requests.post(
    "https://rljnrgscmosgkcjdvlrq.supabase.co/functions/v1/start-finetuning",
    headers={
        "Authorization": "Bearer YOUR_JWT_TOKEN",
        "Content-Type": "application/json"
    },
    json={"job_id": "your-job-id"}
)`,
        jsExample: `const response = await fetch(
  "https://rljnrgscmosgkcjdvlrq.supabase.co/functions/v1/start-finetuning",
  {
    method: "POST",
    headers: {
      "Authorization": "Bearer YOUR_JWT_TOKEN",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ job_id: "your-job-id" })
  }
);`,
        responseExample: `{
  "success": true,
  "message": "Fine-tuning job started successfully",
  "job_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "experiment_id": "exp-123456"
}`,
        errorCodes: [
          { code: 400, message: 'Bad Request', description: 'Job not in pending status' },
          { code: 402, message: 'Payment Required', description: 'Insufficient credits' },
          { code: 404, message: 'Not Found', description: 'Job not found' },
        ],
      },
    ],
  },
  {
    id: 'datasets',
    name: 'Datasets',
    icon: Database,
    endpoints: [
      {
        id: 'upload-dataset',
        method: 'POST',
        path: '/storage/v1/object/datasets/{user_id}/{dataset_id}/{filename}',
        title: 'Upload Dataset File',
        description: 'Upload a JSONL dataset file to storage. Each line should be a JSON object with a "messages" array.',
        auth: true,
        parameters: [
          { name: 'user_id', type: 'string', required: true, description: 'Your user ID' },
          { name: 'dataset_id', type: 'string', required: true, description: 'Dataset record ID' },
          { name: 'filename', type: 'string', required: true, description: 'File name (e.g., data.jsonl)' },
        ],
        requestBody: `// JSONL format - one JSON object per line
{"messages": [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]}
{"messages": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]}`,
        responseBody: `{
  "Key": "datasets/{user_id}/{dataset_id}/data.jsonl"
}`,
        curlExample: `curl -X POST "https://rljnrgscmosgkcjdvlrq.supabase.co/storage/v1/object/datasets/USER_ID/DATASET_ID/data.jsonl" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  --data-binary @your_data.jsonl`,
        pythonExample: `import requests

with open("your_data.jsonl", "rb") as f:
    response = requests.post(
        f"https://rljnrgscmosgkcjdvlrq.supabase.co/storage/v1/object/datasets/{user_id}/{dataset_id}/data.jsonl",
        headers={
            "Authorization": "Bearer YOUR_API_KEY",
            "Content-Type": "application/json"
        },
        data=f
    )`,
        jsExample: `const file = new File([jsonlContent], "data.jsonl");
const response = await fetch(
  \`https://rljnrgscmosgkcjdvlrq.supabase.co/storage/v1/object/datasets/\${userId}/\${datasetId}/data.jsonl\`,
  {
    method: "POST",
    headers: {
      "Authorization": "Bearer YOUR_API_KEY",
      "Content-Type": "application/json"
    },
    body: file
  }
);`,
        responseExample: `{
  "Key": "datasets/user123/dataset456/data.jsonl"
}`,
        errorCodes: [
          { code: 400, message: 'Bad Request', description: 'Invalid file format' },
          { code: 413, message: 'Payload Too Large', description: 'File exceeds 100MB limit' },
        ],
      },
      {
        id: 'list-datasets',
        method: 'GET',
        path: '/rest/v1/datasets',
        title: 'List Datasets',
        description: 'Retrieve all datasets for your account.',
        auth: true,
        parameters: [
          { name: 'select', type: 'string', required: false, description: 'Columns to return' },
          { name: 'status', type: 'string', required: false, description: 'Filter by status' },
        ],
        requestBody: undefined,
        responseBody: `[
  {
    "id": "uuid",
    "name": "string",
    "status": "pending|processing|ready|error",
    "row_count": 1000,
    "total_tokens": 50000,
    "created_at": "timestamp"
  }
]`,
        curlExample: `curl -X GET "https://rljnrgscmosgkcjdvlrq.supabase.co/rest/v1/datasets?select=*" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "apikey: YOUR_ANON_KEY"`,
        pythonExample: `import requests

response = requests.get(
    "https://rljnrgscmosgkcjdvlrq.supabase.co/rest/v1/datasets",
    headers={
        "Authorization": "Bearer YOUR_API_KEY",
        "apikey": "YOUR_ANON_KEY"
    }
)`,
        jsExample: `const response = await fetch(
  "https://rljnrgscmosgkcjdvlrq.supabase.co/rest/v1/datasets",
  {
    headers: {
      "Authorization": "Bearer YOUR_API_KEY",
      "apikey": "YOUR_ANON_KEY"
    }
  }
);`,
        responseExample: `[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Customer Support Data",
    "status": "ready",
    "row_count": 5000,
    "total_tokens": 250000,
    "created_at": "2024-01-10T08:00:00Z"
  }
]`,
        errorCodes: [
          { code: 401, message: 'Unauthorized', description: 'Invalid or missing API key' },
        ],
      },
      {
        id: 'create-snapshot',
        method: 'POST',
        path: '/rest/v1/dataset_snapshots',
        title: 'Create Dataset Snapshot',
        description: 'Create a versioned snapshot of a dataset for use in fine-tuning or evaluation.',
        auth: true,
        parameters: [],
        requestBody: `{
  "dataset_id": "uuid",
  "name": "v1.0",
  "train_split_pct": 0.9,    // 90% training, 10% validation
  "row_count": 1000,
  "s3_path": "datasets/user_id/dataset_id/data.jsonl"
}`,
        responseBody: `{
  "id": "uuid",
  "dataset_id": "uuid",
  "name": "v1.0",
  "version": 1,
  "row_count": 1000,
  "train_row_count": 900,
  "val_row_count": 100
}`,
        curlExample: `curl -X POST "https://rljnrgscmosgkcjdvlrq.supabase.co/rest/v1/dataset_snapshots" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "apikey: YOUR_ANON_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "dataset_id": "your-dataset-id",
    "name": "v1.0",
    "train_split_pct": 0.9
  }'`,
        pythonExample: `import requests

response = requests.post(
    "https://rljnrgscmosgkcjdvlrq.supabase.co/rest/v1/dataset_snapshots",
    headers={
        "Authorization": "Bearer YOUR_API_KEY",
        "apikey": "YOUR_ANON_KEY",
        "Content-Type": "application/json"
    },
    json={
        "dataset_id": "your-dataset-id",
        "name": "v1.0",
        "train_split_pct": 0.9
    }
)`,
        jsExample: `const response = await fetch(
  "https://rljnrgscmosgkcjdvlrq.supabase.co/rest/v1/dataset_snapshots",
  {
    method: "POST",
    headers: {
      "Authorization": "Bearer YOUR_API_KEY",
      "apikey": "YOUR_ANON_KEY",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      dataset_id: "your-dataset-id",
      name: "v1.0",
      train_split_pct: 0.9
    })
  }
);`,
        responseExample: `{
  "id": "snap-123456",
  "dataset_id": "a1b2c3d4",
  "name": "v1.0",
  "version": 1,
  "row_count": 1000,
  "train_row_count": 900,
  "val_row_count": 100,
  "created_at": "2024-01-15T10:30:00Z"
}`,
        errorCodes: [
          { code: 400, message: 'Bad Request', description: 'Invalid dataset_id or parameters' },
          { code: 404, message: 'Not Found', description: 'Dataset not found' },
        ],
      },
    ],
  },
  {
    id: 'evaluations',
    name: 'Evaluations',
    icon: BarChart3,
    endpoints: [
      {
        id: 'create-evaluation',
        method: 'POST',
        path: '/rest/v1/evaluations',
        title: 'Create Evaluation',
        description: 'Create an evaluation to test a model against a dataset using specified metrics.',
        auth: true,
        parameters: [],
        requestBody: `{
  "model_id": "gpt-4o-mini",           // Model to evaluate (base or fine-tuned)
  "snapshot_id": "uuid",                // Dataset snapshot ID
  "metric_ids": ["uuid1", "uuid2"]      // Array of metric IDs to use
}`,
        responseBody: `{
  "id": "uuid",
  "model_id": "gpt-4o-mini",
  "snapshot_id": "uuid",
  "status": "pending",
  "created_at": "timestamp"
}`,
        curlExample: `curl -X POST "https://rljnrgscmosgkcjdvlrq.supabase.co/rest/v1/evaluations" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "apikey: YOUR_ANON_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model_id": "gpt-4o-mini",
    "snapshot_id": "your-snapshot-id",
    "metric_ids": ["metric-id-1", "metric-id-2"]
  }'`,
        pythonExample: `import requests

response = requests.post(
    "https://rljnrgscmosgkcjdvlrq.supabase.co/rest/v1/evaluations",
    headers={
        "Authorization": "Bearer YOUR_API_KEY",
        "apikey": "YOUR_ANON_KEY",
        "Content-Type": "application/json"
    },
    json={
        "model_id": "gpt-4o-mini",
        "snapshot_id": "your-snapshot-id",
        "metric_ids": ["metric-id-1", "metric-id-2"]
    }
)`,
        jsExample: `const response = await fetch(
  "https://rljnrgscmosgkcjdvlrq.supabase.co/rest/v1/evaluations",
  {
    method: "POST",
    headers: {
      "Authorization": "Bearer YOUR_API_KEY",
      "apikey": "YOUR_ANON_KEY",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model_id: "gpt-4o-mini",
      snapshot_id: "your-snapshot-id",
      metric_ids: ["metric-id-1", "metric-id-2"]
    })
  }
);`,
        responseExample: `{
  "id": "eval-123456",
  "model_id": "gpt-4o-mini",
  "snapshot_id": "snap-789",
  "status": "pending",
  "created_at": "2024-01-15T10:30:00Z"
}`,
        errorCodes: [
          { code: 400, message: 'Bad Request', description: 'Invalid model_id or snapshot_id' },
          { code: 404, message: 'Not Found', description: 'Snapshot not found' },
        ],
      },
      {
        id: 'run-evaluation',
        method: 'POST',
        path: '/functions/v1/run-evaluation',
        title: 'Run Evaluation',
        description: 'Start running an evaluation. This processes the dataset and scores with selected metrics.',
        auth: true,
        parameters: [],
        requestBody: `{
  "evaluation_id": "uuid"    // The evaluation ID to run
}`,
        responseBody: `{
  "success": true,
  "evaluation_id": "uuid",
  "status": "running"
}`,
        curlExample: `curl -X POST "https://rljnrgscmosgkcjdvlrq.supabase.co/functions/v1/run-evaluation" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"evaluation_id": "your-evaluation-id"}'`,
        pythonExample: `import requests

response = requests.post(
    "https://rljnrgscmosgkcjdvlrq.supabase.co/functions/v1/run-evaluation",
    headers={
        "Authorization": "Bearer YOUR_JWT_TOKEN",
        "Content-Type": "application/json"
    },
    json={"evaluation_id": "your-evaluation-id"}
)`,
        jsExample: `const response = await fetch(
  "https://rljnrgscmosgkcjdvlrq.supabase.co/functions/v1/run-evaluation",
  {
    method: "POST",
    headers: {
      "Authorization": "Bearer YOUR_JWT_TOKEN",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ evaluation_id: "your-evaluation-id" })
  }
);`,
        responseExample: `{
  "success": true,
  "evaluation_id": "eval-123456",
  "status": "running"
}`,
        errorCodes: [
          { code: 400, message: 'Bad Request', description: 'Evaluation not in pending status' },
          { code: 402, message: 'Payment Required', description: 'Insufficient credits' },
        ],
      },
      {
        id: 'get-results',
        method: 'GET',
        path: '/rest/v1/evaluations?id=eq.{id}',
        title: 'Get Evaluation Results',
        description: 'Retrieve evaluation results including per-metric scores and detailed per-sample results.',
        auth: true,
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Evaluation ID' },
        ],
        requestBody: undefined,
        responseBody: `{
  "id": "uuid",
  "status": "completed",
  "results": {
    "metric_name": {
      "avg": 0.85,
      "min": 0.60,
      "max": 0.95,
      "count": 100
    }
  },
  "detailed_results": [
    {
      "input": "...",
      "expected": "...",
      "actual": "...",
      "scores": {...}
    }
  ]
}`,
        curlExample: `curl -X GET "https://rljnrgscmosgkcjdvlrq.supabase.co/rest/v1/evaluations?id=eq.YOUR_EVAL_ID&select=*" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "apikey: YOUR_ANON_KEY"`,
        pythonExample: `import requests

response = requests.get(
    f"https://rljnrgscmosgkcjdvlrq.supabase.co/rest/v1/evaluations?id=eq.{eval_id}&select=*",
    headers={
        "Authorization": "Bearer YOUR_API_KEY",
        "apikey": "YOUR_ANON_KEY"
    }
)`,
        jsExample: `const response = await fetch(
  \`https://rljnrgscmosgkcjdvlrq.supabase.co/rest/v1/evaluations?id=eq.\${evalId}&select=*\`,
  {
    headers: {
      "Authorization": "Bearer YOUR_API_KEY",
      "apikey": "YOUR_ANON_KEY"
    }
  }
);`,
        responseExample: `[{
  "id": "eval-123456",
  "status": "completed",
  "results": {
    "Correctness": { "avg": 0.87, "min": 0.65, "max": 0.98, "count": 100 },
    "Conciseness": { "avg": 0.92, "min": 0.80, "max": 1.0, "count": 100 }
  },
  "completed_at": "2024-01-15T11:00:00Z"
}]`,
        errorCodes: [
          { code: 404, message: 'Not Found', description: 'Evaluation not found' },
        ],
      },
    ],
  },
  {
    id: 'models',
    name: 'Models',
    icon: Cpu,
    endpoints: [
      {
        id: 'list-models',
        method: 'GET',
        path: '/rest/v1/models',
        title: 'List Fine-tuned Models',
        description: 'Retrieve all fine-tuned models for your account.',
        auth: true,
        parameters: [
          { name: 'select', type: 'string', required: false, description: 'Columns to return' },
          { name: 'is_deployed', type: 'boolean', required: false, description: 'Filter by deployment status' },
        ],
        requestBody: undefined,
        responseBody: `[
  {
    "id": "uuid",
    "name": "string",
    "model_id": "string",
    "base_model": "string",
    "is_deployed": boolean,
    "created_at": "timestamp"
  }
]`,
        curlExample: `curl -X GET "https://rljnrgscmosgkcjdvlrq.supabase.co/rest/v1/models?select=*" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "apikey: YOUR_ANON_KEY"`,
        pythonExample: `import requests

response = requests.get(
    "https://rljnrgscmosgkcjdvlrq.supabase.co/rest/v1/models",
    headers={
        "Authorization": "Bearer YOUR_API_KEY",
        "apikey": "YOUR_ANON_KEY"
    }
)`,
        jsExample: `const response = await fetch(
  "https://rljnrgscmosgkcjdvlrq.supabase.co/rest/v1/models",
  {
    headers: {
      "Authorization": "Bearer YOUR_API_KEY",
      "apikey": "YOUR_ANON_KEY"
    }
  }
);`,
        responseExample: `[
  {
    "id": "model-123",
    "name": "Customer Support Bot v2",
    "model_id": "sv-cust-support-v2",
    "base_model": "Qwen/Qwen2.5-1.5B",
    "is_deployed": true,
    "parameter_count": 1500000000,
    "created_at": "2024-01-15T12:45:00Z"
  }
]`,
        errorCodes: [
          { code: 401, message: 'Unauthorized', description: 'Invalid or missing API key' },
        ],
      },
      {
        id: 'delete-model',
        method: 'DELETE',
        path: '/rest/v1/models?id=eq.{id}',
        title: 'Delete Model',
        description: 'Delete a fine-tuned model. This also removes the model checkpoint from storage.',
        auth: true,
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Model ID to delete' },
        ],
        requestBody: undefined,
        responseBody: `// Empty response on success (204 No Content)`,
        curlExample: `curl -X DELETE "https://rljnrgscmosgkcjdvlrq.supabase.co/rest/v1/models?id=eq.YOUR_MODEL_ID" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "apikey: YOUR_ANON_KEY"`,
        pythonExample: `import requests

response = requests.delete(
    f"https://rljnrgscmosgkcjdvlrq.supabase.co/rest/v1/models?id=eq.{model_id}",
    headers={
        "Authorization": "Bearer YOUR_API_KEY",
        "apikey": "YOUR_ANON_KEY"
    }
)`,
        jsExample: `const response = await fetch(
  \`https://rljnrgscmosgkcjdvlrq.supabase.co/rest/v1/models?id=eq.\${modelId}\`,
  {
    method: "DELETE",
    headers: {
      "Authorization": "Bearer YOUR_API_KEY",
      "apikey": "YOUR_ANON_KEY"
    }
  }
);`,
        responseExample: `// 204 No Content`,
        errorCodes: [
          { code: 404, message: 'Not Found', description: 'Model not found' },
          { code: 409, message: 'Conflict', description: 'Model is currently deployed' },
        ],
      },
    ],
  },
];

const methodColors: Record<string, string> = {
  GET: 'bg-green-500/10 text-green-500 border-green-500/20',
  POST: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  PUT: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  DELETE: 'bg-red-500/10 text-red-500 border-red-500/20',
  PATCH: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
};

export default function ApiDocs() {
  const [activeCategory, setActiveCategory] = useState('auth');
  const [activeEndpoint, setActiveEndpoint] = useState('auth-overview');
  const [apiKey, setApiKey] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'reference' | 'explorer'>('reference');
  const { toast } = useToast();

  const currentCategory = categories.find(c => c.id === activeCategory);
  const currentEndpoint = currentCategory?.endpoints.find(e => e.id === activeEndpoint);

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: 'Copied to clipboard' });
  };

  const personalizeExample = (code: string) => {
    if (!apiKey) return code;
    return code
      .replace(/YOUR_API_KEY/g, apiKey)
      .replace(/sv_your_api_key/g, apiKey);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([getOpenApiJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'swissvault-openapi.json';
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Downloaded OpenAPI JSON' });
  };

  const handleDownloadYaml = () => {
    const blob = new Blob([getOpenApiYaml()], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'swissvault-openapi.yaml';
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Downloaded OpenAPI YAML' });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2">
              <SwissFlag className="h-8 w-8 rounded-lg" />
              <span className="text-lg font-semibold text-foreground">
                SwissVault<span className="text-brand-accent">.ai</span>
              </span>
            </Link>
            <div className="h-6 w-px bg-border" />
            <span className="text-sm font-medium text-muted-foreground">API Documentation</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Tab Switcher */}
            <div className="flex items-center bg-muted rounded-lg p-1">
              <button
                onClick={() => setActiveTab('reference')}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                  activeTab === 'reference'
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Reference
              </button>
              <button
                onClick={() => setActiveTab('explorer')}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5",
                  activeTab === 'explorer'
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Zap className="h-3.5 w-3.5" />
                API Explorer
              </button>
            </div>
            <div className="h-6 w-px bg-border" />
            <Link to="/dashboard">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="sm">Get API Key</Button>
            </Link>
          </div>
        </div>
      </header>

      {activeTab === 'explorer' ? (
        /* Interactive API Explorer */
        <div className="flex">
          <aside className="sticky top-16 h-[calc(100vh-4rem)] w-64 border-r border-border bg-muted/30 p-4 space-y-4">
            {/* API Key Input for Explorer */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Your API Key
              </label>
              <Input
                type="password"
                placeholder="sv_..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="mt-1.5 text-xs"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Pre-fill auth for "Try it out"
              </p>
            </div>
            
            <div className="border-t border-border pt-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Download Spec
              </h3>
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start gap-2"
                  onClick={handleDownloadJson}
                >
                  <FileJson className="h-4 w-4" />
                  OpenAPI JSON
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start gap-2"
                  onClick={handleDownloadYaml}
                >
                  <FileCode className="h-4 w-4" />
                  OpenAPI YAML
                </Button>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Import to Tools
              </h3>
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start gap-2"
                  onClick={() => {
                    handleDownloadJson();
                    toast({ 
                      title: 'Import to Postman',
                      description: 'Open Postman → Import → Upload the downloaded JSON file'
                    });
                  }}
                >
                  <Download className="h-4 w-4" />
                  Postman Collection
                </Button>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Generate SDK
              </h3>
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start gap-2"
                  onClick={() => {
                    window.open('https://editor.swagger.io/', '_blank');
                    toast({
                      title: 'Generate SDK',
                      description: 'Paste the OpenAPI spec in Swagger Editor → Generate Client → Python/TypeScript'
                    });
                  }}
                >
                  <FileCode className="h-4 w-4" />
                  Python SDK
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start gap-2"
                  onClick={() => {
                    window.open('https://editor.swagger.io/', '_blank');
                    toast({
                      title: 'Generate SDK',
                      description: 'Paste the OpenAPI spec in Swagger Editor → Generate Client → TypeScript'
                    });
                  }}
                >
                  <FileCode className="h-4 w-4" />
                  TypeScript SDK
                </Button>
              </div>
            </div>
          </aside>
          
          <main className="flex-1 p-6">
            <Suspense fallback={
              <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            }>
              <SwaggerUIWrapper apiKey={apiKey} />
            </Suspense>
          </main>
        </div>
      ) : (
        /* Reference Documentation */
        <div className="flex">
        {/* Left Sidebar - Categories */}
        <aside className="sticky top-16 h-[calc(100vh-4rem)] w-64 border-r border-border bg-muted/30 overflow-y-auto">
          <div className="p-4 space-y-1">
            <div className="px-3 py-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                API Reference
              </h3>
            </div>
            {categories.map((category) => (
              <div key={category.id}>
                <button
                  onClick={() => {
                    setActiveCategory(category.id);
                    setActiveEndpoint(category.endpoints[0].id);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    activeCategory === category.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <category.icon className="h-4 w-4" />
                  {category.name}
                </button>
                {activeCategory === category.id && (
                  <div className="ml-6 mt-1 space-y-0.5">
                    {category.endpoints.map((endpoint) => (
                      <button
                        key={endpoint.id}
                        onClick={() => setActiveEndpoint(endpoint.id)}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded transition-colors",
                          activeEndpoint === endpoint.id
                            ? "text-primary font-medium"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <ChevronRight className="h-3 w-3" />
                        {endpoint.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* API Key Input */}
          <div className="p-4 border-t border-border">
            <label className="text-xs font-medium text-muted-foreground">
              Your API Key (personalizes examples)
            </label>
            <Input
              type="password"
              placeholder="sv_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="mt-1.5 text-xs"
            />
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 max-w-4xl p-8">
          {currentEndpoint && (
            <div className="space-y-8">
              {/* Endpoint Header */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <Badge className={cn("font-mono text-xs", methodColors[currentEndpoint.method])}>
                    {currentEndpoint.method}
                  </Badge>
                  <code className="text-sm font-mono text-foreground bg-muted px-2 py-1 rounded">
                    {currentEndpoint.path}
                  </code>
                </div>
                <h1 className="text-2xl font-bold text-foreground">{currentEndpoint.title}</h1>
                <p className="text-muted-foreground mt-2">{currentEndpoint.description}</p>
                {currentEndpoint.auth && (
                  <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                    <Key className="h-4 w-4" />
                    <span>Requires authentication</span>
                  </div>
                )}
              </div>

              {/* Parameters */}
              {currentEndpoint.parameters && currentEndpoint.parameters.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-3">Parameters</h2>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium text-foreground">Name</th>
                          <th className="text-left px-4 py-2 font-medium text-foreground">Type</th>
                          <th className="text-left px-4 py-2 font-medium text-foreground">Required</th>
                          <th className="text-left px-4 py-2 font-medium text-foreground">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentEndpoint.parameters.map((param) => (
                          <tr key={param.name} className="border-t border-border">
                            <td className="px-4 py-2 font-mono text-primary">{param.name}</td>
                            <td className="px-4 py-2 text-muted-foreground">{param.type}</td>
                            <td className="px-4 py-2">
                              <Badge variant={param.required ? "default" : "outline"} className="text-xs">
                                {param.required ? 'Yes' : 'No'}
                              </Badge>
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">{param.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Request Body */}
              {currentEndpoint.requestBody && (
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-3">Request Body</h2>
                  <div className="relative">
                    <pre className="bg-muted/50 border border-border rounded-lg p-4 overflow-x-auto text-sm font-mono">
                      <code>{currentEndpoint.requestBody}</code>
                    </pre>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => handleCopy(currentEndpoint.requestBody!, 'request-body')}
                    >
                      {copiedId === 'request-body' ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Code Examples */}
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-3">Example Request</h2>
                <Tabs defaultValue="curl" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="curl">cURL</TabsTrigger>
                    <TabsTrigger value="python">Python</TabsTrigger>
                    <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                  </TabsList>
                  <TabsContent value="curl">
                    <div className="relative">
                      <pre className="bg-[#1e1e2e] text-[#cdd6f4] border border-border rounded-lg p-4 overflow-x-auto text-sm font-mono">
                        <code>{personalizeExample(currentEndpoint.curlExample)}</code>
                      </pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 text-white/70 hover:text-white"
                        onClick={() => handleCopy(personalizeExample(currentEndpoint.curlExample), 'curl')}
                      >
                        {copiedId === 'curl' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </TabsContent>
                  <TabsContent value="python">
                    <div className="relative">
                      <pre className="bg-[#1e1e2e] text-[#cdd6f4] border border-border rounded-lg p-4 overflow-x-auto text-sm font-mono">
                        <code>{personalizeExample(currentEndpoint.pythonExample)}</code>
                      </pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 text-white/70 hover:text-white"
                        onClick={() => handleCopy(personalizeExample(currentEndpoint.pythonExample), 'python')}
                      >
                        {copiedId === 'python' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </TabsContent>
                  <TabsContent value="javascript">
                    <div className="relative">
                      <pre className="bg-[#1e1e2e] text-[#cdd6f4] border border-border rounded-lg p-4 overflow-x-auto text-sm font-mono">
                        <code>{personalizeExample(currentEndpoint.jsExample)}</code>
                      </pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 text-white/70 hover:text-white"
                        onClick={() => handleCopy(personalizeExample(currentEndpoint.jsExample), 'js')}
                      >
                        {copiedId === 'js' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Response Example */}
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-3">Example Response</h2>
                <div className="relative">
                  <pre className="bg-muted/50 border border-border rounded-lg p-4 overflow-x-auto text-sm font-mono">
                    <code>{currentEndpoint.responseExample}</code>
                  </pre>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => handleCopy(currentEndpoint.responseExample, 'response')}
                  >
                    {copiedId === 'response' ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Error Codes */}
              {currentEndpoint.errorCodes && currentEndpoint.errorCodes.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-3">Error Codes</h2>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium text-foreground">Code</th>
                          <th className="text-left px-4 py-2 font-medium text-foreground">Message</th>
                          <th className="text-left px-4 py-2 font-medium text-foreground">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentEndpoint.errorCodes.map((error) => (
                          <tr key={error.code} className="border-t border-border">
                            <td className="px-4 py-2">
                              <Badge variant="outline" className="font-mono">
                                {error.code}
                              </Badge>
                            </td>
                            <td className="px-4 py-2 font-medium text-foreground">{error.message}</td>
                            <td className="px-4 py-2 text-muted-foreground">{error.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Try It Button */}
              <div className="pt-4 border-t border-border">
                <Button className="gap-2" onClick={() => setActiveTab('explorer')}>
                  <Play className="h-4 w-4" />
                  Try it in API Explorer
                  <Zap className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </main>

        {/* Right Sidebar - Quick Nav */}
        <aside className="sticky top-16 h-[calc(100vh-4rem)] w-48 border-l border-border bg-muted/30 p-4 hidden xl:block">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            On this page
          </h3>
          <nav className="space-y-1 text-sm">
            {currentEndpoint?.parameters && currentEndpoint.parameters.length > 0 && (
              <a href="#" className="block text-muted-foreground hover:text-foreground py-1">Parameters</a>
            )}
            {currentEndpoint?.requestBody && (
              <a href="#" className="block text-muted-foreground hover:text-foreground py-1">Request Body</a>
            )}
            <a href="#" className="block text-muted-foreground hover:text-foreground py-1">Example Request</a>
            <a href="#" className="block text-muted-foreground hover:text-foreground py-1">Example Response</a>
            {currentEndpoint?.errorCodes && currentEndpoint.errorCodes.length > 0 && (
              <a href="#" className="block text-muted-foreground hover:text-foreground py-1">Error Codes</a>
            )}
          </nav>
          
          <div className="mt-6 pt-4 border-t border-border">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Downloads
            </h3>
            <div className="space-y-2">
              <button 
                onClick={handleDownloadJson}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground py-1"
              >
                <FileJson className="h-3.5 w-3.5" />
                OpenAPI JSON
              </button>
              <button 
                onClick={handleDownloadYaml}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground py-1"
              >
                <FileCode className="h-3.5 w-3.5" />
                OpenAPI YAML
              </button>
            </div>
          </div>
        </aside>
      </div>
      )}
    </div>
  );
}
