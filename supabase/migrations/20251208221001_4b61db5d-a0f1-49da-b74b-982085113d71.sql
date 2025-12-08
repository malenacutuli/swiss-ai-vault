-- Fix: Allow document MIME types in datasets bucket for synthetic data generation
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY[
  -- Existing allowed types
  'application/json',
  'application/jsonl',
  'application/x-jsonlines',
  'application/octet-stream',
  'text/plain',
  'text/csv',
  -- NEW: Document formats for synthetic data generation
  'text/markdown',
  'text/html',
  'text/xml',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.ms-powerpoint',
  'application/vnd.ms-excel'
]
WHERE name = 'datasets';