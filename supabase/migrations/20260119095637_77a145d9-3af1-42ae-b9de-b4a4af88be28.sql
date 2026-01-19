-- Drop the overly permissive admin policy that allows viewing all user profiles
DROP POLICY IF EXISTS "Admins can view all user profiles" ON public.users;

-- Also drop any duplicate update policy
DROP POLICY IF EXISTS "Authenticated users can update own profile" ON public.users;