-- Create contacts table for managing contact information
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('whatsapp', 'telegram', 'instagram', 'other')),
  url TEXT NOT NULL,
  icon TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Everyone can view active contacts
CREATE POLICY "Everyone can view active contacts"
ON public.contacts
FOR SELECT
USING (is_active = true);

-- Admins can manage contacts
CREATE POLICY "Admins can manage contacts"
ON public.contacts
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_contacts_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default contacts
INSERT INTO public.contacts (name, type, url, display_order) VALUES
('Менеджер Нариман', 'whatsapp', 'https://wa.me/996555123456', 1),
('Менеджер Жыйдалик', 'whatsapp', 'https://wa.me/996555123457', 2),
('Менеджер Достук', 'whatsapp', 'https://wa.me/996555123458', 3),
('Группа WhatsApp', 'whatsapp', 'https://chat.whatsapp.com/example', 4),
('Канал Telegram обучения', 'telegram', 'https://t.me/abucargo', 5),
('Instagram', 'instagram', 'https://instagram.com/abucargo', 6);