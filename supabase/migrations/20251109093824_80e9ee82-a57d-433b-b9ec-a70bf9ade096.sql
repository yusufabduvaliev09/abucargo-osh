-- Исправляем search_path для функций безопасности
DROP FUNCTION IF EXISTS public.generate_auth_token(TEXT);

CREATE OR REPLACE FUNCTION public.generate_auth_token(client_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  random_suffix TEXT;
BEGIN
  random_suffix := encode(gen_random_bytes(16), 'hex');
  RETURN client_code || '-' || random_suffix;
END;
$$;