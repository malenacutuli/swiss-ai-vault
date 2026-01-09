-- Add metadata column to agent_task_logs if not exists
ALTER TABLE agent_task_logs
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;

-- Add index for faster log queries
CREATE INDEX IF NOT EXISTS idx_agent_task_logs_task_id_seq 
ON agent_task_logs(task_id, sequence_number);

-- Add comment for documentation
COMMENT ON COLUMN agent_task_logs.metadata IS 'Additional structured data for the log entry';