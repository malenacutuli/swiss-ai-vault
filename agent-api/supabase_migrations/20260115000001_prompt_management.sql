-- Phase 5: Prompt Management System
-- Production-grade prompt versioning, A/B testing, and metrics

-- Prompt Versions Table
CREATE TABLE IF NOT EXISTS prompt_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_prompt_version UNIQUE (prompt_id, version),
    CONSTRAINT valid_status CHECK (status IN ('draft', 'active', 'archived', 'deprecated'))
);

-- Prompt Templates Table
CREATE TABLE IF NOT EXISTS prompt_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    template TEXT NOT NULL,
    variables JSONB NOT NULL DEFAULT '[]'::jsonb,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- A/B Tests Table
CREATE TABLE IF NOT EXISTS prompt_ab_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_id TEXT UNIQUE NOT NULL,
    prompt_a_id TEXT NOT NULL,
    prompt_b_id TEXT NOT NULL,
    split DECIMAL(3,2) NOT NULL DEFAULT 0.50,
    status TEXT NOT NULL DEFAULT 'running',
    metrics_a JSONB DEFAULT '{}'::jsonb,
    metrics_b JSONB DEFAULT '{}'::jsonb,
    winner TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT valid_test_status CHECK (status IN ('running', 'completed', 'archived')),
    CONSTRAINT valid_split CHECK (split > 0 AND split < 1)
);

-- Prompt Metrics Table
CREATE TABLE IF NOT EXISTS prompt_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_id TEXT NOT NULL,
    version INTEGER,
    execution_id UUID,
    success BOOLEAN NOT NULL,
    latency DECIMAL(10,3) NOT NULL,
    score DECIMAL(5,2),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    INDEX idx_prompt_metrics_prompt_id (prompt_id),
    INDEX idx_prompt_metrics_created_at (created_at)
);

-- Indexes for performance
CREATE INDEX idx_prompt_versions_prompt_id ON prompt_versions(prompt_id);
CREATE INDEX idx_prompt_versions_status ON prompt_versions(status);
CREATE INDEX idx_prompt_ab_tests_status ON prompt_ab_tests(status);

-- RLS Policies
ALTER TABLE prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_metrics ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role has full access to prompt_versions"
    ON prompt_versions FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to prompt_templates"
    ON prompt_templates FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to prompt_ab_tests"
    ON prompt_ab_tests FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to prompt_metrics"
    ON prompt_metrics FOR ALL
    USING (auth.role() = 'service_role');

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers
CREATE TRIGGER update_prompt_versions_updated_at
    BEFORE UPDATE ON prompt_versions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prompt_templates_updated_at
    BEFORE UPDATE ON prompt_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
