-- Fix security warning: set search_path on generate_client_code function
CREATE OR REPLACE FUNCTION public.generate_client_code(pvz public.pvz_location)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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