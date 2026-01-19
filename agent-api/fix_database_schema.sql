-- Fix for credit_balances.available_credits column
-- Run this in Supabase SQL Editor

-- Check if column exists first
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'credit_balances'
        AND column_name = 'available_credits'
    ) THEN
        -- Add the missing column
        ALTER TABLE credit_balances
        ADD COLUMN available_credits INTEGER NOT NULL DEFAULT 100;

        RAISE NOTICE 'Column available_credits added successfully';
    ELSE
        RAISE NOTICE 'Column available_credits already exists';
    END IF;
END $$;

-- Ensure all existing users have credits
UPDATE credit_balances
SET available_credits = 100
WHERE available_credits IS NULL OR available_credits = 0;

-- Verify the fix
SELECT
    user_id,
    available_credits,
    created_at
FROM credit_balances
LIMIT 10;
