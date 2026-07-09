
-- Limpa versão anterior
DROP FUNCTION IF EXISTS public.get_inscricao_status(text);
DROP TABLE IF EXISTS public.inscricoes CASCADE;

-- Reaproveita o enum inscricao_status (já existe)
DO $$ BEGIN
  CREATE TYPE public.inscricao_status AS ENUM ('pendente','pago','recusado','reembolsado','chargeback');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Nova tabela em português
CREATE TABLE public.inscricoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  email text NOT NULL,
  celular text NOT NULL,                       -- 13 dígitos (ex: 5562999999999)
  valor numeric(10,2) NOT NULL DEFAULT 39.90,
  status public.inscricao_status NOT NULL DEFAULT 'pendente',
  greenn_sale_id text,
  metodo_pagamento text,
  greenn_payload jsonb,
  pago_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inscricoes_celular_idx ON public.inscricoes (celular);
CREATE INDEX inscricoes_email_idx ON public.inscricoes (email);
CREATE INDEX inscricoes_greenn_sale_id_idx ON public.inscricoes (greenn_sale_id);

-- Grants (Data API)
GRANT INSERT ON public.inscricoes TO anon, authenticated;
GRANT SELECT ON public.inscricoes TO authenticated;   -- só admin passa na policy
GRANT ALL ON public.inscricoes TO service_role;

ALTER TABLE public.inscricoes ENABLE ROW LEVEL SECURITY;

-- Insert público, com status forçado a 'pendente' e greenn_sale_id nulo
CREATE POLICY "Público cria inscrição pendente"
  ON public.inscricoes FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'pendente'
    AND greenn_sale_id IS NULL
    AND pago_em IS NULL
  );

-- Leitura via Data API só para admin
CREATE POLICY "Admins leem inscrições"
  ON public.inscricoes FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Trigger atualizado_em
CREATE OR REPLACE FUNCTION public.tg_inscricoes_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END $$;

CREATE TRIGGER inscricoes_touch
BEFORE UPDATE ON public.inscricoes
FOR EACH ROW EXECUTE FUNCTION public.tg_inscricoes_touch();

-- Tabela de log/auditoria dos webhooks da Greenn
CREATE TABLE public.greenn_webhook_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  greenn_sale_id text,
  status_recebido text,
  status_mapeado public.inscricao_status,
  inscricao_id uuid REFERENCES public.inscricoes(id) ON DELETE SET NULL,
  event_hash text UNIQUE,                       -- dedupe: hash de sale_id+status
  payload jsonb NOT NULL,
  processado boolean NOT NULL DEFAULT false,
  erro text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX greenn_webhook_logs_sale_idx ON public.greenn_webhook_logs (greenn_sale_id);
CREATE INDEX greenn_webhook_logs_criado_idx ON public.greenn_webhook_logs (criado_em DESC);

GRANT SELECT ON public.greenn_webhook_logs TO authenticated;   -- só admin via policy
GRANT ALL ON public.greenn_webhook_logs TO service_role;

ALTER TABLE public.greenn_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins leem logs greenn"
  ON public.greenn_webhook_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- RPC pública: devolve status de UMA inscrição pelo id
CREATE OR REPLACE FUNCTION public.verificar_status_inscricao(_id uuid)
RETURNS TABLE(status public.inscricao_status, nome text, pago_em timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.status, i.nome, i.pago_em
  FROM public.inscricoes i
  WHERE i.id = _id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.verificar_status_inscricao(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verificar_status_inscricao(uuid) TO anon, authenticated;
