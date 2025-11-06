-- Добавляем поле telegram_id в таблицу profiles
ALTER TABLE public.profiles
ADD COLUMN telegram_id TEXT UNIQUE;

-- Создаем индекс для быстрого поиска по telegram_id
CREATE INDEX idx_profiles_telegram_id ON public.profiles(telegram_id);

-- Обновляем trigger функцию для обработки telegram_id при регистрации
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_client_code TEXT;
BEGIN
  -- Генерируем client_code
  new_client_code := generate_client_code(
    (new.raw_user_meta_data->>'pvz_location')::pvz_location
  );
  
  -- Создаём профиль с поддержкой telegram_id
  INSERT INTO public.profiles (
    user_id,
    full_name,
    phone,
    client_code,
    pvz_location,
    telegram_id
  ) VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    new_client_code,
    (new.raw_user_meta_data->>'pvz_location')::pvz_location,
    new.raw_user_meta_data->>'telegram_id'
  );
  
  -- Создаём роль по умолчанию
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'user');
  
  RETURN new;
END;
$function$;