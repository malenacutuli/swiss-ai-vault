-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- USER ROLES (Secure pattern - separate table)
-- ============================================

CREATE TYPE public.app_role AS ENUM ('admin', 'owner', 'member', 'viewer');

CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============================================
-- ORGANIZATIONS
-- ============================================

CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    tier VARCHAR(50) DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- USERS (Profile table - no role column!)
-- ============================================

CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ============================================
-- API KEYS
-- ============================================

CREATE TABLE public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(10) NOT NULL,
    permissions JSONB DEFAULT '["read", "write"]',
    rate_limit_tier VARCHAR(50) DEFAULT 'standard',
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROJECTS
-- ============================================

CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'setup' CHECK (status IN ('setup', 'dataset', 'finetuning', 'evaluation', 'complete')),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DATASETS
-- ============================================

CREATE TYPE public.dataset_source_type AS ENUM ('upload', 'synthetic', 'enriched', 'merged');
CREATE TYPE public.dataset_status AS ENUM ('pending', 'processing', 'ready', 'error');

CREATE TABLE public.datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    source_type public.dataset_source_type NOT NULL DEFAULT 'upload',
    status public.dataset_status DEFAULT 'pending',
    row_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    avg_conversation_length FLOAT,
    s3_path TEXT,
    source_config JSONB DEFAULT '{}',
    quality_metrics JSONB DEFAULT '{}',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.dataset_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    row_count INTEGER NOT NULL,
    train_split_pct FLOAT DEFAULT 0.9 CHECK (train_split_pct > 0 AND train_split_pct <= 0.99),
    train_row_count INTEGER,
    val_row_count INTEGER,
    s3_path TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(dataset_id, version)
);

ALTER TABLE public.dataset_snapshots ENABLE ROW LEVEL SECURITY;

-- ============================================
-- FINE-TUNING
-- ============================================

CREATE TYPE public.finetuning_status AS ENUM ('pending', 'queued', 'training', 'completed', 'failed', 'cancelled');
CREATE TYPE public.finetuning_method AS ENUM ('full', 'lora', 'qlora');

CREATE TABLE public.finetuning_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    snapshot_id UUID NOT NULL REFERENCES public.dataset_snapshots(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    base_model VARCHAR(255) NOT NULL,
    method public.finetuning_method DEFAULT 'lora',
    status public.finetuning_status DEFAULT 'pending',
    hyperparameters JSONB NOT NULL DEFAULT '{"batch_size": 4, "learning_rate": 0.0002, "epochs": 3, "warmup_ratio": 0.03, "lora_r": 16, "lora_alpha": 32}',
    training_metrics JSONB DEFAULT '{}',
    s3_checkpoint_path TEXT,
    s3_gguf_path TEXT,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.finetuning_jobs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.finetuning_jobs(id) ON DELETE CASCADE,
    name VARCHAR(255),
    config JSONB NOT NULL,
    status public.finetuning_status DEFAULT 'pending',
    training_loss JSONB DEFAULT '[]',
    final_loss FLOAT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.experiments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- MODELS
-- ============================================

CREATE TABLE public.models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    finetuning_job_id UUID REFERENCES public.finetuning_jobs(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    model_id VARCHAR(255) NOT NULL UNIQUE,
    base_model VARCHAR(255) NOT NULL,
    description TEXT,
    s3_checkpoint_path TEXT,
    s3_gguf_path TEXT,
    parameter_count BIGINT,
    context_length INTEGER,
    is_deployed BOOLEAN DEFAULT FALSE,
    deployment_config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;

-- ============================================
-- EVALUATIONS
-- ============================================

CREATE TABLE public.metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    metric_type VARCHAR(50) DEFAULT 'llm_judge' CHECK (metric_type IN ('llm_judge', 'string_match', 'lcs', 'custom')),
    rules JSONB NOT NULL DEFAULT '{"should": [], "should_not": []}',
    system_prompt TEXT,
    is_builtin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.metrics ENABLE ROW LEVEL SECURITY;

CREATE TYPE public.evaluation_status AS ENUM ('pending', 'running', 'completed', 'failed');

CREATE TABLE public.evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    snapshot_id UUID NOT NULL REFERENCES public.dataset_snapshots(id) ON DELETE CASCADE,
    model_id UUID NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
    metric_ids UUID[] NOT NULL,
    status public.evaluation_status DEFAULT 'pending',
    results JSONB DEFAULT '{}',
    detailed_results JSONB DEFAULT '[]',
    byoe_endpoint TEXT,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DEPLOYMENTS & TRACES
-- ============================================

CREATE TABLE public.deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    endpoint_url TEXT,
    deployment_type VARCHAR(50) DEFAULT 'serverless' CHECK (deployment_type IN ('serverless', 'dedicated', 'vpc')),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'deploying', 'active', 'stopped', 'failed')),
    config JSONB DEFAULT '{}',
    gpu_type VARCHAR(50),
    replicas INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.traces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    api_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
    model_id VARCHAR(255) NOT NULL,
    request JSONB NOT NULL,
    response JSONB,
    latency_ms INTEGER,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    status_code INTEGER,
    error_message TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.traces ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- User roles: users can only see their own roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Organizations: members can view
CREATE POLICY "Org members can view" ON public.organizations FOR SELECT 
    USING (id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()));

-- Users: can view and update own profile
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- API Keys: strict user-only access
CREATE POLICY "Users can manage own API keys" ON public.api_keys FOR ALL USING (user_id = auth.uid());

-- Projects
CREATE POLICY "Users can view own projects" ON public.projects FOR SELECT 
    USING (user_id = auth.uid() OR organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "Users can insert own projects" ON public.projects FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own projects" ON public.projects FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own projects" ON public.projects FOR DELETE USING (user_id = auth.uid());

-- Datasets
CREATE POLICY "Users can view own datasets" ON public.datasets FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own datasets" ON public.datasets FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own datasets" ON public.datasets FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own datasets" ON public.datasets FOR DELETE USING (user_id = auth.uid());

-- Dataset snapshots (via dataset ownership)
CREATE POLICY "Users can view own snapshots" ON public.dataset_snapshots FOR SELECT 
    USING (dataset_id IN (SELECT id FROM public.datasets WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own snapshots" ON public.dataset_snapshots FOR INSERT 
    WITH CHECK (dataset_id IN (SELECT id FROM public.datasets WHERE user_id = auth.uid()));

-- Fine-tuning jobs
CREATE POLICY "Users can view own jobs" ON public.finetuning_jobs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own jobs" ON public.finetuning_jobs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own jobs" ON public.finetuning_jobs FOR UPDATE USING (user_id = auth.uid());

-- Experiments (via job ownership)
CREATE POLICY "Users can view own experiments" ON public.experiments FOR SELECT 
    USING (job_id IN (SELECT id FROM public.finetuning_jobs WHERE user_id = auth.uid()));

-- Models
CREATE POLICY "Users can view own models" ON public.models FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own models" ON public.models FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own models" ON public.models FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own models" ON public.models FOR DELETE USING (user_id = auth.uid());

-- Metrics: users can see own + builtin
CREATE POLICY "Users can view metrics" ON public.metrics FOR SELECT 
    USING (is_builtin = TRUE OR user_id = auth.uid());
CREATE POLICY "Users can manage own metrics" ON public.metrics FOR ALL 
    USING (user_id = auth.uid() AND is_builtin = FALSE);

-- Evaluations
CREATE POLICY "Users can view own evaluations" ON public.evaluations FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own evaluations" ON public.evaluations FOR INSERT WITH CHECK (user_id = auth.uid());

-- Deployments
CREATE POLICY "Users can view own deployments" ON public.deployments FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can manage own deployments" ON public.deployments FOR ALL USING (user_id = auth.uid());

-- Traces
CREATE POLICY "Users can view own traces" ON public.traces FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert traces" ON public.traces FOR INSERT WITH CHECK (user_id = auth.uid());

-- Admin policies using has_role function
CREATE POLICY "Admins can view all users" ON public.users FOR SELECT 
    USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view all projects" ON public.projects FOR SELECT 
    USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view all jobs" ON public.finetuning_jobs FOR SELECT 
    USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_datasets_updated_at BEFORE UPDATE ON public.datasets
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_deployments_updated_at BEFORE UPDATE ON public.deployments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create user profile and assign default role on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'member');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_projects_organization_id ON public.projects(organization_id);
CREATE INDEX idx_datasets_project_id ON public.datasets(project_id);
CREATE INDEX idx_datasets_user_id ON public.datasets(user_id);
CREATE INDEX idx_snapshots_dataset_id ON public.dataset_snapshots(dataset_id);
CREATE INDEX idx_finetuning_jobs_project_id ON public.finetuning_jobs(project_id);
CREATE INDEX idx_finetuning_jobs_user_id ON public.finetuning_jobs(user_id);
CREATE INDEX idx_finetuning_jobs_status ON public.finetuning_jobs(status);
CREATE INDEX idx_experiments_job_id ON public.experiments(job_id);
CREATE INDEX idx_models_user_id ON public.models(user_id);
CREATE INDEX idx_models_organization_id ON public.models(organization_id);
CREATE INDEX idx_metrics_project_id ON public.metrics(project_id);
CREATE INDEX idx_evaluations_project_id ON public.evaluations(project_id);
CREATE INDEX idx_evaluations_model_id ON public.evaluations(model_id);
CREATE INDEX idx_evaluations_status ON public.evaluations(status);
CREATE INDEX idx_traces_project_id ON public.traces(project_id);
CREATE INDEX idx_traces_created_at ON public.traces(created_at);
CREATE INDEX idx_traces_created_at_desc ON public.traces(created_at DESC);
CREATE INDEX idx_traces_model_id ON public.traces(model_id);

-- ============================================
-- INSERT BUILTIN METRICS
-- ============================================

INSERT INTO public.metrics (name, description, metric_type, is_builtin, rules, system_prompt) VALUES
('Correctness', 'Measures factual accuracy of responses', 'llm_judge', TRUE, 
 '{"should": ["Be factually accurate", "Directly answer the question"], "should_not": ["Contain incorrect information", "Be evasive"]}',
 'You are evaluating the correctness of an AI response. Score 0-1 based on factual accuracy.'),
('Conciseness', 'Measures brevity without losing meaning', 'llm_judge', TRUE,
 '{"should": ["Be brief and to the point", "Include only relevant information"], "should_not": ["Include unnecessary details", "Be repetitive"]}',
 'You are evaluating conciseness. Score 0-1 based on how efficiently the response conveys information.'),
('Hallucination', 'Detects fabricated or made-up information', 'llm_judge', TRUE,
 '{"should": ["Only state information that can be verified", "Acknowledge uncertainty when appropriate"], "should_not": ["Make up facts", "Invent citations or sources"]}',
 'You are detecting hallucinations. Score 1 for no hallucination, 0 for severe hallucination.');