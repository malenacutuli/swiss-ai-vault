-- Add preferences column to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{
  "theme": "light",
  "default_model": "gemini-2.0-flash",
  "temperature": 0.7,
  "language": "en",
  "notifications_email": true,
  "notifications_push": false,
  "privacy_mode": "standard",
  "data_retention_days": 365
}'::JSONB;

-- Add updated_at column
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add full_name if missing
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);

-- Add avatar_url if missing
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Backfill existing rows with default preferences
UPDATE profiles
SET preferences = '{
  "theme": "light",
  "default_model": "gemini-2.0-flash",
  "temperature": 0.7,
  "language": "en",
  "notifications_email": true,
  "notifications_push": false,
  "privacy_mode": "standard",
  "data_retention_days": 365
}'::JSONB
WHERE preferences IS NULL;

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_profiles_updated_at();
