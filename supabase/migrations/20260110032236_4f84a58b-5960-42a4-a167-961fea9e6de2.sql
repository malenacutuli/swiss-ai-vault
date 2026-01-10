-- Create agent_tool_executions table for tracking tool usage
-- Check if table exists first
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agent_tool_executions') THEN
        -- Table already exists, skip creation
        RAISE NOTICE 'agent_tool_executions table already exists';
    END IF;
END $$;

-- Add missing columns if table exists but is incomplete
DO $$
BEGIN
    -- Add required_confirmation column if missing
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agent_tool_executions') THEN
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agent_tool_executions' AND column_name = 'required_confirmation') THEN
            ALTER TABLE public.agent_tool_executions ADD COLUMN required_confirmation BOOLEAN DEFAULT false;
        END IF;
        
        -- Add user_confirmed column if missing
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agent_tool_executions' AND column_name = 'user_confirmed') THEN
            ALTER TABLE public.agent_tool_executions ADD COLUMN user_confirmed BOOLEAN DEFAULT NULL;
        END IF;
        
        -- Add tool_category column if missing
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agent_tool_executions' AND column_name = 'tool_category') THEN
            ALTER TABLE public.agent_tool_executions ADD COLUMN tool_category TEXT;
        END IF;
    END IF;
END $$;

-- Create index on tool_name for analytics queries
CREATE INDEX IF NOT EXISTS idx_tool_executions_tool_name ON public.agent_tool_executions(tool_name);

-- Create index for finding pending confirmations
CREATE INDEX IF NOT EXISTS idx_tool_executions_pending ON public.agent_tool_executions(required_confirmation, user_confirmed) 
WHERE required_confirmation = true AND user_confirmed IS NULL;

-- Enable RLS on the table
ALTER TABLE public.agent_tool_executions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for agent_tool_executions (only if they don't exist)
DO $$
BEGIN
    -- Drop existing policies to recreate them
    DROP POLICY IF EXISTS "Users can view their own tool executions" ON public.agent_tool_executions;
    DROP POLICY IF EXISTS "Users can insert their own tool executions" ON public.agent_tool_executions;
    DROP POLICY IF EXISTS "Users can update their own tool executions" ON public.agent_tool_executions;
END $$;

-- Policy: Users can view their own tool executions
CREATE POLICY "Users can view their own tool executions"
ON public.agent_tool_executions
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own tool executions
CREATE POLICY "Users can insert their own tool executions"
ON public.agent_tool_executions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own tool executions (for confirmation)
CREATE POLICY "Users can update their own tool executions"
ON public.agent_tool_executions
FOR UPDATE
USING (auth.uid() = user_id);