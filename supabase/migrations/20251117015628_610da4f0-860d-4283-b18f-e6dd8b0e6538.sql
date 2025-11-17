-- Create table for WhatsApp message templates per PVZ
CREATE TABLE public.whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pvz_location public.pvz_location NOT NULL UNIQUE,
  template TEXT NOT NULL,
  updated_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Admins can manage all templates
CREATE POLICY "Admins can manage templates"
ON public.whatsapp_templates
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Everyone can view templates
CREATE POLICY "Everyone can view templates"
ON public.whatsapp_templates
FOR SELECT
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_whatsapp_templates_updated_at
BEFORE UPDATE ON public.whatsapp_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default templates for each PVZ
INSERT INTO public.whatsapp_templates (pvz_location, template) VALUES
('nariman', 'Здравствуйте, уважаемый(ая) {customerId} 📦

Ваши посылки прибыли с трек-кодами:
{codesList}
({codesCount} шт)

⚖️ Вес посылок: {weight} кг
💰 Стоимость: {totalPrice} сом

📍 Адрес самовывоза: Нариман — Ул. Сулайманова 32
⏰ График работы: 9:00 до 21:00

💳 Реквизиты для оплаты:
Мбанк: 0552820112

После оплаты обязательно отправьте чек. 🧾

Важно❗ Забрать нужно в течение 5 дней, иначе хранение 20 сом/день.

С уважением, команда ABU Cargo ❤️'),

('zhiydalik', 'Здравствуйте, уважаемый(ая) {customerId} 📦

Ваши посылки прибыли с трек-кодами:
{codesList}
({codesCount} шт)

⚖️ Вес посылок: {weight} кг
💰 Стоимость: {totalPrice} сом

📍 Адрес самовывоза: Жийдалик УПТК — Наби Кожо 61Б
⏰ График работы: 9:00 до 21:00

💳 Реквизиты для оплаты:
Мбанк: 0552820112

После оплаты обязательно отправьте чек. 🧾

Важно❗ Забрать нужно в течение 5 дней, иначе хранение 20 сом/день.

С уважением, команда ABU Cargo ❤️'),

('dostuk', 'Здравствуйте, уважаемый(ая) {customerId} 📦

Ваши посылки прибыли с трек-кодами:
{codesList}
({codesCount} шт)

⚖️ Вес посылок: {weight} кг
💰 Стоимость: {totalPrice} сом

📍 Адрес самовывоза: Достук — Хабиба Абдуллаева 78
⏰ График работы: 9:00 до 21:00

💳 Реквизиты для оплаты:
Мбанк: 0552820112

После оплаты обязательно отправьте чек. 🧾

Важно❗ Забрать нужно в течение 5 дней, иначе хранение 20 сом/день.

С уважением, команда ABU Cargo ❤️');