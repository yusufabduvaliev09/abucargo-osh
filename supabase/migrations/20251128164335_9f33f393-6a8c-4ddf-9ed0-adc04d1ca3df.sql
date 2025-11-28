-- Включить realtime для таблицы settings
ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;

-- Включить realtime для таблицы pvz_locations_config
ALTER PUBLICATION supabase_realtime ADD TABLE public.pvz_locations_config;