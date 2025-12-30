-- Drop the check constraint that's blocking signups
ALTER TABLE public.ghost_subscriptions DROP CONSTRAINT IF EXISTS ghost_subscriptions_plan_check;