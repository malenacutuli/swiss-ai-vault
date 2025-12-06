-- Enable REPLICA IDENTITY for full row data on updates
ALTER TABLE finetuning_jobs REPLICA IDENTITY FULL;
ALTER TABLE experiments REPLICA IDENTITY FULL;
ALTER TABLE datasets REPLICA IDENTITY FULL;
ALTER TABLE evaluations REPLICA IDENTITY FULL;
ALTER TABLE models REPLICA IDENTITY FULL;
ALTER TABLE api_keys REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE finetuning_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE experiments;
ALTER PUBLICATION supabase_realtime ADD TABLE datasets;
ALTER PUBLICATION supabase_realtime ADD TABLE evaluations;
ALTER PUBLICATION supabase_realtime ADD TABLE models;
ALTER PUBLICATION supabase_realtime ADD TABLE api_keys;