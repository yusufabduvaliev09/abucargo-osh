-- Create table for mass message logs
CREATE TABLE IF NOT EXISTS public.mass_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  track_codes TEXT[] NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'sent',
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mass_messages ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can view all mass messages"
  ON public.mass_messages
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert mass messages"
  ON public.mass_messages
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create index for performance
CREATE INDEX idx_mass_messages_user_id ON public.mass_messages(user_id);
CREATE INDEX idx_mass_messages_sent_at ON public.mass_messages(sent_at DESC);