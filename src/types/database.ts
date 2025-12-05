// ============================================
// PROJECT TYPES
// ============================================

export type ProjectStatus = 'setup' | 'dataset' | 'finetuning' | 'evaluation' | 'complete';

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
  organization_id?: string | null;
  settings?: Record<string, unknown>;
  // Computed fields
  datasets_count?: number;
  models_count?: number;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: ProjectStatus;
}

// ============================================
// DATASET TYPES
// ============================================

export type DatasetStatus = 'pending' | 'processing' | 'ready' | 'failed';
export type SourceType = 'upload' | 'synthetic' | 'url' | 'youtube';

export interface Dataset {
  id: string;
  user_id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  source_type: SourceType;
  source_config: Record<string, unknown>;
  status: DatasetStatus;
  row_count: number;
  total_tokens: number;
  avg_conversation_length: number | null;
  quality_metrics: Record<string, unknown>;
  s3_path: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface DatasetSnapshot {
  id: string;
  dataset_id: string;
  name: string;
  version: number;
  row_count: number;
  train_split_pct: number;
  train_row_count: number | null;
  val_row_count: number | null;
  s3_path: string;
  created_at: string;
}

export interface CreateDatasetInput {
  name: string;
  project_id?: string;
  source_type: SourceType;
  description?: string;
  source_config?: Record<string, unknown>;
}

// ============================================
// FINE-TUNING TYPES
// ============================================

export type FinetuningStatus = 'pending' | 'queued' | 'training' | 'completed' | 'failed' | 'cancelled';
export type FinetuningMethod = 'full' | 'lora' | 'qlora';

export interface HyperParameters {
  epochs: number;
  batch_size: number;
  learning_rate: number;
  warmup_ratio: number;
  lora_r?: number;
  lora_alpha?: number;
  lora_dropout?: number;
  use_4bit?: boolean;
}

export const DEFAULT_HYPERPARAMETERS: HyperParameters = {
  epochs: 3,
  batch_size: 4,
  learning_rate: 0.0002,
  warmup_ratio: 0.03,
  lora_r: 16,
  lora_alpha: 32,
};

export interface FinetuningJob {
  id: string;
  user_id: string;
  project_id: string | null;
  snapshot_id: string;
  name: string;
  base_model: string;
  method: FinetuningMethod;
  status: FinetuningStatus;
  hyperparameters: HyperParameters;
  training_metrics: Record<string, unknown>;
  s3_checkpoint_path: string | null;
  s3_gguf_path: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface Experiment {
  id: string;
  job_id: string;
  name: string | null;
  config: HyperParameters;
  status: FinetuningStatus;
  training_loss: number[];
  final_loss: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface CreateFinetuningJobInput {
  name: string;
  snapshot_id: string;
  base_model: string;
  method: FinetuningMethod;
  hyperparameters: HyperParameters;
  project_id?: string;
}

// Base models available for fine-tuning
export const BASE_MODELS = [
  { id: 'Qwen/Qwen2.5-0.5B-Instruct', name: 'Qwen 2.5 0.5B', parameters: '0.5B', family: 'Qwen', gated: false },
  { id: 'Qwen/Qwen2.5-1.5B-Instruct', name: 'Qwen 2.5 1.5B', parameters: '1.5B', family: 'Qwen', gated: false },
  { id: 'Qwen/Qwen2.5-3B-Instruct', name: 'Qwen 2.5 3B', parameters: '3B', family: 'Qwen', gated: false },
  { id: 'Qwen/Qwen2.5-7B-Instruct', name: 'Qwen 2.5 7B', parameters: '7B', family: 'Qwen', gated: false },
  { id: 'meta-llama/Llama-3.2-1B-Instruct', name: 'Llama 3.2 1B', parameters: '1B', family: 'Llama', gated: true },
  { id: 'meta-llama/Llama-3.2-3B-Instruct', name: 'Llama 3.2 3B', parameters: '3B', family: 'Llama', gated: true },
  { id: 'mistralai/Mistral-7B-Instruct-v0.3', name: 'Mistral 7B', parameters: '7B', family: 'Mistral', gated: false },
  { id: 'google/gemma-2-2b-it', name: 'Gemma 2 2B', parameters: '2B', family: 'Gemma', gated: false },
  { id: 'google/gemma-2-9b-it', name: 'Gemma 2 9B', parameters: '9B', family: 'Gemma', gated: false },
] as const;

export type BaseModelId = typeof BASE_MODELS[number]['id'];

// ============================================
// EVALUATION TYPES
// ============================================

export type EvaluationStatus = 'pending' | 'running' | 'completed' | 'failed';
export type MetricType = 'string_match' | 'lcs' | 'llm_judge' | 'custom' | 'byoe';

export interface MetricRules {
  should?: string[];
  should_not?: string[];
  rubric?: string;
  webhook_url?: string;
}

export interface Metric {
  id: string;
  user_id: string | null;
  project_id: string | null;
  name: string;
  description: string | null;
  metric_type: string;
  system_prompt: string | null;
  rules: MetricRules;
  is_builtin: boolean;
  created_at: string;
}

export interface EvaluationResult {
  average: number;
  min: number;
  max: number;
  count: number;
}

export interface DetailedEvaluationResult {
  input: string;
  expected: string;
  actual: string;
  scores: Record<string, number>;
  reasoning?: string;
}

export interface Evaluation {
  id: string;
  user_id: string;
  project_id: string | null;
  model_id: string;
  snapshot_id: string;
  metric_ids: string[];
  byoe_endpoint: string | null;
  status: EvaluationStatus;
  results: Record<string, EvaluationResult> | null;
  detailed_results: DetailedEvaluationResult[] | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface CreateEvaluationInput {
  model_id: string;
  snapshot_id: string;
  metric_ids: string[];
  project_id?: string;
  byoe_endpoint?: string;
}

export interface CreateMetricInput {
  name: string;
  description?: string;
  rules: MetricRules;
  project_id?: string;
}

// Built-in metrics
export const BUILTIN_METRICS = [
  {
    id: 'correctness',
    name: 'Correctness',
    description: 'Measures factual accuracy of the response',
    metric_type: 'llm_judge',
  },
  {
    id: 'conciseness',
    name: 'Conciseness',
    description: 'Evaluates brevity and efficiency of the response',
    metric_type: 'llm_judge',
  },
  {
    id: 'hallucination',
    name: 'Hallucination Detection',
    description: 'Detects fabricated or incorrect information',
    metric_type: 'llm_judge',
  },
] as const;

// ============================================
// MODEL TYPES
// ============================================

export interface Model {
  id: string;
  user_id: string;
  organization_id: string | null;
  finetuning_job_id: string | null;
  model_id: string; // e.g., "sv-llama3.2-3b-abc123"
  name: string;
  description: string | null;
  base_model: string;
  parameter_count: number | null;
  context_length: number | null;
  is_deployed: boolean;
  s3_checkpoint_path: string | null;
  s3_gguf_path: string | null;
  deployment_config: Record<string, unknown>;
  created_at: string;
}

export interface DeploymentConfig {
  gpu_type?: string;
  replicas?: number;
  max_batch_size?: number;
  timeout_ms?: number;
}

// ============================================
// DEPLOYMENT TYPES
// ============================================

export type DeploymentStatus = 'pending' | 'provisioning' | 'running' | 'stopped' | 'failed';
export type DeploymentType = 'serverless' | 'dedicated' | 'vpc';

export interface Deployment {
  id: string;
  user_id: string;
  model_id: string;
  deployment_type: DeploymentType;
  status: DeploymentStatus;
  endpoint_url: string | null;
  gpu_type: string | null;
  replicas: number;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ============================================
// API KEY TYPES
// ============================================

export interface ApiKey {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string; // "svk_abc123..."
  key_hash: string;
  permissions: string[];
  rate_limit_tier: string;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

export interface CreateApiKeyInput {
  name: string;
  permissions?: string[];
  expires_at?: string;
}

export interface ApiKeyWithSecret extends ApiKey {
  fullKey: string; // Only available immediately after creation
}

// ============================================
// USAGE & BILLING TYPES
// ============================================

export interface UsageDaily {
  id: string;
  user_id: string;
  date: string;
  metric: string;
  value: number;
  created_at: string;
}

export interface UsageFinetuning {
  id: string;
  user_id: string;
  job_id: string;
  base_model: string;
  gpu_minutes: number;
  cost: number;
  created_at: string;
}

export type BillingTier = 'free' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing';

export interface BillingCustomer {
  id: string;
  user_id: string;
  email: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  tier: BillingTier;
  subscription_status: SubscriptionStatus | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingInvoice {
  id: string;
  stripe_customer_id: string;
  stripe_invoice_id: string;
  amount: number;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string;
}

// ============================================
// TRACE TYPES (for inference logging)
// ============================================

export interface Trace {
  id: string;
  user_id: string;
  project_id: string | null;
  api_key_id: string | null;
  model_id: string;
  request: {
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    max_tokens?: number;
    [key: string]: unknown;
  };
  response: {
    choices: Array<{ message: { role: string; content: string } }>;
    [key: string]: unknown;
  } | null;
  status_code: number | null;
  latency_ms: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  error_message: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// ============================================
// USER & ORGANIZATION TYPES
// ============================================

export type AppRole = 'admin' | 'moderator' | 'member';

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  tier: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
