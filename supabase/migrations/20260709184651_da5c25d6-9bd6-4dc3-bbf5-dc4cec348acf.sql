
-- Enum de status
DO $$ BEGIN
  CREATE TYPE public.inscricao_status AS ENUM ('pendente','pago','recusado','reembolsado','chargeback');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela inscricoes
CREATE TABLE public.inscricoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,           -- somente dígitos (11)
  status public.inscricao_status NOT NULL DEFAULT 'pendente',
  greenn_sale_id text,
  greenn_payload jsonb,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inscricoes_phone_idx ON public.inscricoes (phone);
CREATE INDEX inscricoes_email_idx ON public.inscricoes (email);
CREATE INDEX inscricoes_greenn_sale_id_idx ON public.inscricoes (greenn_sale_id);

-- Grants: anon pode inserir; admin lê via has_role; service_role tudo (usado pela edge function)
GRANT INSERT ON public.inscricoes TO anon, authenticated;
GRANT SELECT ON public.inscricoes TO authenticated;
GRANT ALL ON public.inscricoes TO service_role;

ALTER TABLE public.inscricoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create inscricao"
  ON public.inscricoes FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view inscricoes"
  ON public.inscricoes FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

CREATE TRIGGER inscricoes_set_updated_at
BEFORE UPDATE ON public.inscricoes
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- RPC pública para consulta de status por telefone (normaliza dígitos)
CREATE OR REPLACE FUNCTION public.get_inscricao_status(_phone text)
RETURNS TABLE(status public.inscricao_status, full_name text, paid_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.status, i.full_name, i.paid_at
  FROM public.inscricoes i
  WHERE i.phone = regexp_replace(coalesce(_phone,''), '\D', '', 'g')
  ORDER BY i.created_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_inscricao_status(text) TO anon, authenticated;
