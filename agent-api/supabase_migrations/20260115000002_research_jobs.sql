-- Phase 7: Wide Research System
-- Database schema for parallel multi-agent research jobs

-- Research Jobs Table
CREATE TABLE IF NOT EXISTS research_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id TEXT UNIQUE NOT NULL,
    topic TEXT NOT NULL,
    num_agents INTEGER NOT NULL DEFAULT 5,
    max_depth INTEGER NOT NULL DEFAULT 3,
    status TEXT NOT NULL DEFAULT 'pending',
    progress INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error TEXT,

    CONSTRAINT valid_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    CONSTRAINT valid_progress CHECK (progress >= 0 AND progress <= 100),
    CONSTRAINT valid_num_agents CHECK (num_agents > 0 AND num_agents <= 20)
);

-- Research Subtasks Table
CREATE TABLE IF NOT EXISTS research_subtasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id TEXT NOT NULL REFERENCES research_jobs(job_id) ON DELETE CASCADE,
    agent_id INTEGER NOT NULL,
    aspect TEXT NOT NULL,
    query TEXT NOT NULL,
    depth INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT valid_subtask_status CHECK (status IN ('pending', 'running', 'completed', 'failed'))
);

-- Research Results Table
CREATE TABLE IF NOT EXISTS research_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id TEXT NOT NULL REFERENCES research_jobs(job_id) ON DELETE CASCADE,
    agent_id INTEGER NOT NULL,
    aspect TEXT NOT NULL,
    summary TEXT,
    findings JSONB DEFAULT '[]'::jsonb,
    recommendations JSONB DEFAULT '[]'::jsonb,
    sources JSONB DEFAULT '[]'::jsonb,
    confidence DECIMAL(3,2) DEFAULT 0.50,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT valid_confidence CHECK (confidence >= 0 AND confidence <= 1)
);

-- Research Synthesis Table
CREATE TABLE IF NOT EXISTS research_synthesis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id TEXT UNIQUE NOT NULL REFERENCES research_jobs(job_id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    summary TEXT,
    key_findings JSONB DEFAULT '[]'::jsonb,
    recommendations JSONB DEFAULT '[]'::jsonb,
    sources JSONB DEFAULT '[]'::jsonb,
    confidence DECIMAL(3,2) DEFAULT 0.50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_research_jobs_status ON research_jobs(status);
CREATE INDEX idx_research_jobs_created_at ON research_jobs(created_at);
CREATE INDEX idx_research_jobs_job_id ON research_jobs(job_id);
CREATE INDEX idx_research_subtasks_job_id ON research_subtasks(job_id);
CREATE INDEX idx_research_subtasks_status ON research_subtasks(status);
CREATE INDEX idx_research_results_job_id ON research_results(job_id);
CREATE INDEX idx_research_synthesis_job_id ON research_synthesis(job_id);

-- RLS Policies
ALTER TABLE research_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_synthesis ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role has full access to research_jobs"
    ON research_jobs FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to research_subtasks"
    ON research_subtasks FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to research_results"
    ON research_results FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to research_synthesis"
    ON research_synthesis FOR ALL
    USING (auth.role() = 'service_role');

-- Updated_at trigger for synthesis table
CREATE TRIGGER update_research_synthesis_updated_at
    BEFORE UPDATE ON research_synthesis
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
