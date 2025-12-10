-- Document processing jobs table for async upload status tracking
CREATE TABLE public.document_processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.encrypted_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- File info
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  handler TEXT NOT NULL, -- claude-extract, direct-text, xlsx-parse, csv-parse, claude-vision
  storage_path TEXT,
  
  -- Processing status
  status TEXT DEFAULT 'queued' CHECK (status IN (
    'queued', 'uploading', 'extracting', 'embedding', 'complete', 'failed'
  )),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  error_message TEXT,
  
  -- Results
  chunks_created INTEGER DEFAULT 0,
  processing_time_ms INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.document_processing_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own processing jobs"
  ON public.document_processing_jobs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own processing jobs"
  ON public.document_processing_jobs FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own processing jobs"
  ON public.document_processing_jobs FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own processing jobs"
  ON public.document_processing_jobs FOR DELETE
  USING (user_id = auth.uid());

-- Indexes for performance
CREATE INDEX idx_doc_jobs_user_id ON public.document_processing_jobs(user_id);
CREATE INDEX idx_doc_jobs_conversation_id ON public.document_processing_jobs(conversation_id);
CREATE INDEX idx_doc_jobs_status ON public.document_processing_jobs(status);

-- Enable realtime for status updates
ALTER TABLE public.document_processing_jobs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.document_processing_jobs;