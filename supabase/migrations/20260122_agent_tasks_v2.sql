-- Swiss Agents V2 - Database Schema
-- Migration for agent_tasks_v2 and agent_steps_v2 tables

-- Create agent_tasks_v2 table
CREATE TABLE IF NOT EXISTS agent_tasks_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'idle' CHECK (state IN ('idle', 'planning', 'executing', 'waiting_user', 'completed', 'failed', 'cancelled')),
    plan JSONB,
    current_phase_id INTEGER DEFAULT 0,
    options JSONB DEFAULT '{}',
    attachments TEXT[] DEFAULT '{}',
    result JSONB,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Create agent_steps_v2 table
CREATE TABLE IF NOT EXISTS agent_steps_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES agent_tasks_v2(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    tool_name TEXT NOT NULL,
    tool_input JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    output TEXT,
    error TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_agent_tasks_v2_user_id ON agent_tasks_v2(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_v2_state ON agent_tasks_v2(state);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_v2_created_at ON agent_tasks_v2(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_steps_v2_task_id ON agent_steps_v2(task_id);

-- Enable RLS
ALTER TABLE agent_tasks_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_steps_v2 ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agent_tasks_v2
CREATE POLICY "Users can view their own tasks"
    ON agent_tasks_v2 FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tasks"
    ON agent_tasks_v2 FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks"
    ON agent_tasks_v2 FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can do everything"
    ON agent_tasks_v2 FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for agent_steps_v2
CREATE POLICY "Users can view steps of their own tasks"
    ON agent_steps_v2 FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM agent_tasks_v2 
        WHERE agent_tasks_v2.id = agent_steps_v2.task_id 
        AND agent_tasks_v2.user_id = auth.uid()
    ));

CREATE POLICY "Service role can do everything on steps"
    ON agent_steps_v2 FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_agent_task_v2_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_agent_tasks_v2_updated_at ON agent_tasks_v2;
CREATE TRIGGER trigger_agent_tasks_v2_updated_at
    BEFORE UPDATE ON agent_tasks_v2
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_task_v2_updated_at();
