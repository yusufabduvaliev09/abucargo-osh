-- Remove auth_token column from profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS auth_token;

-- Drop the generate_auth_token function as it's no longer needed
DROP FUNCTION IF EXISTS public.generate_auth_token(text);