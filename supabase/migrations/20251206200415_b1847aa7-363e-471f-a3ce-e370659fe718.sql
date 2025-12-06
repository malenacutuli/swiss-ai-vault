-- Fix key_prefix column to allow longer prefixes
ALTER TABLE api_keys ALTER COLUMN key_prefix TYPE TEXT;