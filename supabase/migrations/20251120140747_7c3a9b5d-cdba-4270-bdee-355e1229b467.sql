-- Создаем таблицу для управления ПВЗ
CREATE TABLE IF NOT EXISTS public.pvz_locations_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Добавляем поля в таблицу settings для названия компании
ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS company_name TEXT DEFAULT 'AbuCargo';

-- Включаем RLS
ALTER TABLE public.pvz_locations_config ENABLE ROW LEVEL SECURITY;

-- Политики для pvz_locations_config
CREATE POLICY "Все видят активные ПВЗ"
ON public.pvz_locations_config
FOR SELECT
USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Админы управляют ПВЗ"
ON public.pvz_locations_config
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Триггер для updated_at
CREATE TRIGGER update_pvz_locations_config_updated_at
BEFORE UPDATE ON public.pvz_locations_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Вставляем существующие ПВЗ
INSERT INTO public.pvz_locations_config (code, name, address) VALUES
  ('nariman', 'Нариман', 'Адрес Нариман'),
  ('zhiydalik', 'Жийдалик', 'Адрес Жийдалик'),
  ('dostuk', 'Достук', 'Адрес Достук')
ON CONFLICT (code) DO NOTHING;