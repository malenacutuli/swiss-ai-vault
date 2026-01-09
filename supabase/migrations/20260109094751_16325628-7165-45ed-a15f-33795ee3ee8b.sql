-- Create agent_git_commits table for tracking version history
CREATE TABLE IF NOT EXISTS public.agent_git_commits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.agent_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  commit_hash TEXT NOT NULL,
  short_hash TEXT NOT NULL,
  message TEXT NOT NULL,
  author TEXT DEFAULT 'Swiss Agent',
  files_changed INTEGER DEFAULT 0,
  insertions INTEGER DEFAULT 0,
  deletions INTEGER DEFAULT 0,
  parent_hash TEXT,
  diff_content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX idx_git_commits_task ON public.agent_git_commits(task_id, created_at DESC);
CREATE INDEX idx_git_commits_user ON public.agent_git_commits(user_id, created_at DESC);
CREATE INDEX idx_git_commits_hash ON public.agent_git_commits(commit_hash);

-- Enable Row Level Security
ALTER TABLE public.agent_git_commits ENABLE ROW LEVEL SECURITY;

-- RLS Policies - users can only access their own commits
CREATE POLICY "Users can view their own commits"
ON public.agent_git_commits
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own commits"
ON public.agent_git_commits
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own commits"
ON public.agent_git_commits
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);