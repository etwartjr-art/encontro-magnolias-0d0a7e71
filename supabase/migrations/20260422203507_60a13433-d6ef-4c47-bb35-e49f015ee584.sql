CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  prayer_request TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Anyone (anonymous visitors) can insert a subscription via the public form
CREATE POLICY "Anyone can submit a subscription"
  ON public.subscriptions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- No public read access (admin will read via service role / dashboard)
CREATE POLICY "No public read"
  ON public.subscriptions
  FOR SELECT
  USING (false);