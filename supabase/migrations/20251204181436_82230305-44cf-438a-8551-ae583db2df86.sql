-- Update datasets bucket to allow application/octet-stream and other common MIME types for .jsonl files
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY[
  'application/json', 
  'application/jsonl', 
  'application/x-jsonlines',
  'application/octet-stream',
  'text/plain', 
  'text/csv'
]
WHERE name = 'datasets';