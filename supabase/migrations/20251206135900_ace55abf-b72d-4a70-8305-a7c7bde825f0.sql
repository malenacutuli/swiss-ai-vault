-- Add missing notification columns to existing user_settings table
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS notification_email BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_browser BOOLEAN DEFAULT true;