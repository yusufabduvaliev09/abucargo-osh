
-- Migration: 20251104165208

-- Migration: 20251104080607

-- Migration: 20251104072225
-- Создаем enum для ролей
CREATE TYPE public.app_role AS ENUM ('user', 'admin', 'pvz');

-- Создаем enum для локаций ПВЗ
CREATE TYPE public.pvz_location AS ENUM ('nariman', 'zhiydalik', 'dostuk');

-- Создаем enum для статусов посылок
CREATE TYPE public.package_status AS ENUM ('in_transit', 'arrived', 'delivered');

-- Таблица профилей пользователей
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  client_code TEXT UNIQUE NOT NULL,
  pvz_location pvz_location NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Таблица ролей пользователей
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user_id, role)
);

-- Таблица посылок
CREATE TABLE public.packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_number TEXT NOT NULL UNIQUE,
  weight DECIMAL(10, 2) NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  client_code TEXT,
  status package_status DEFAULT 'in_transit' NOT NULL,
  price_per_kg DECIMAL(10, 2),
  total_price DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  arrived_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE
);

-- Таблица настроек приложения
CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logo_url TEXT,
  price_per_kg DECIMAL(10, 2) DEFAULT 12.00,
  contact_info JSONB,
  primary_color TEXT DEFAULT '#10b981',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Вставляем начальные настройки
INSERT INTO public.settings (price_per_kg) VALUES (12.00);

-- Функция для генерации client_code
CREATE OR REPLACE FUNCTION public.generate_client_code(pvz pvz_location)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefix TEXT;
  next_number INTEGER;
  new_code TEXT;
BEGIN
  -- Определяем префикс по ПВЗ
  prefix := CASE pvz
    WHEN 'nariman' THEN 'YQ'
    WHEN 'zhiydalik' THEN 'YX'
    WHEN 'dostuk' THEN 'JL'
  END;
  
  -- Находим максимальный номер для данного префикса
  SELECT COALESCE(MAX(CAST(SUBSTRING(client_code FROM LENGTH(prefix) + 1) AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.profiles
  WHERE client_code LIKE prefix || '%';
  
  new_code := prefix || next_number;
  
  RETURN new_code;
END;
$$;

-- Функция для проверки роли пользователя
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Триггер для создания профиля при регистрации
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_client_code TEXT;
BEGIN
  -- Генерируем client_code
  new_client_code := generate_client_code(
    (new.raw_user_meta_data->>'pvz_location')::pvz_location
  );
  
  -- Создаём профиль
  INSERT INTO public.profiles (
    user_id,
    full_name,
    phone,
    client_code,
    pvz_location
  ) VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    new_client_code,
    (new.raw_user_meta_data->>'pvz_location')::pvz_location
  );
  
  -- Создаём роль по умолчанию
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'user');
  
  RETURN new;
END;
$$;

-- Триггер на создание пользователя
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_packages_updated_at
  BEFORE UPDATE ON public.packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS политики для profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Пользователи видят свой профиль"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Пользователи обновляют свой профиль"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Админы видят все профили"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Админы обновляют все профили"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Админы удаляют профили"
  ON public.profiles FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS политики для user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Пользователи видят свои роли"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Админы видят все роли"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Админы управляют ролями"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS политики для packages
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Пользователи видят свои посылки"
  ON public.packages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Админы видят все посылки"
  ON public.packages FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Админы управляют посылками"
  ON public.packages FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "ПВЗ видят посылки своего пункта"
  ON public.packages FOR SELECT
  USING (
    public.has_role(auth.uid(), 'pvz') AND
    client_code IN (
      SELECT client_code FROM public.profiles
      WHERE pvz_location = (
        SELECT pvz_location FROM public.profiles WHERE user_id = auth.uid()
      )
    )
  );

-- RLS политики для settings
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Все видят настройки"
  ON public.settings FOR SELECT
  USING (true);

CREATE POLICY "Админы управляют настройками"
  ON public.settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));


-- Migration: 20251104125050
-- Add new status 'waiting_arrival' to package_status enum
ALTER TYPE package_status ADD VALUE IF NOT EXISTS 'waiting_arrival';

-- Migration: 20251104132155
-- Add INSERT policy for users to create their own packages with waiting_arrival status
CREATE POLICY "Users can insert their own packages"
  ON public.packages FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'waiting_arrival');


-- Migration: 20251105020859
-- Обновляем RLS политики для общей видимости посылок в статусе "in_transit"

-- Удаляем старую политику для пользователей
DROP POLICY IF EXISTS "Пользователи видят свои посылки" ON public.packages;

-- Создаём новую политику: пользователи видят все посылки в статусе "in_transit" и свои остальные
CREATE POLICY "Пользователи видят все в пути и свои"
ON public.packages
FOR SELECT
TO authenticated
USING (
  status = 'in_transit'::package_status 
  OR auth.uid() = user_id
);
