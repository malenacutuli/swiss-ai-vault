-- Add user_rating to tasks
ALTER TABLE agent_tasks
ADD COLUMN IF NOT EXISTS user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5);