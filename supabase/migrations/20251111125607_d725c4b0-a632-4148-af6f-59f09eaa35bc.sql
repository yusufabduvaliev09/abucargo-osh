-- 1) Make client_code and phone unique to enforce business rules
DO $$ BEGIN
  -- Add unique constraints if not existing
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_client_code_key'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_client_code_key UNIQUE (client_code);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_phone_key'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_phone_key UNIQUE (phone);
  END IF;
END $$;

-- 2) Update trigger function to respect provided client_code and only generate when absent
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  provided_client_code TEXT;
  pvz public.pvz_location;
  final_client_code TEXT;
BEGIN
  provided_client_code := new.raw_user_meta_data->>'client_code';
  BEGIN
    pvz := (new.raw_user_meta_data->>'pvz_location')::public.pvz_location;
  EXCEPTION WHEN others THEN
    pvz := NULL;
  END;

  -- Use provided client_code if present, otherwise generate
  IF provided_client_code IS NOT NULL AND length(trim(provided_client_code)) > 0 THEN
    final_client_code := trim(provided_client_code);
  ELSE
    final_client_code := public.generate_client_code(pvz);
  END IF;

  -- Insert profile; will fail if client_code/phone duplicate due to unique constraints
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
    final_client_code,
    pvz,
    new.raw_user_meta_data->>'telegram_id'
  );

  -- Ensure default role 'user' exists for the new account
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN new;
END;
$$;