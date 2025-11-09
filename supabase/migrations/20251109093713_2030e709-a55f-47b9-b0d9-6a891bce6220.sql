-- Добавляем поле для токенов аутентификации
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS auth_token TEXT UNIQUE;

-- Функция для генерации уникального токена
CREATE OR REPLACE FUNCTION public.generate_auth_token(client_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  random_suffix TEXT;
BEGIN
  random_suffix := encode(gen_random_bytes(16), 'hex');
  RETURN client_code || '-' || random_suffix;
END;
$$;

-- Обновляем существующие профили токенами
UPDATE public.profiles
SET auth_token = generate_auth_token(client_code)
WHERE auth_token IS NULL;