-- Add String Matching and LCS built-in metrics
INSERT INTO metrics (id, user_id, name, description, metric_type, rules, is_builtin)
VALUES 
  ('11111111-1111-1111-1111-111111111111', NULL, 'String Matching', 'Exact or fuzzy string match comparison', 'string_match', '{"should": [], "should_not": [], "fuzzy": true}', true),
  ('22222222-2222-2222-2222-222222222222', NULL, 'LCS Score', 'Longest Common Subsequence similarity', 'lcs', '{"should": [], "should_not": [], "normalize": true}', true)
ON CONFLICT (id) DO NOTHING;