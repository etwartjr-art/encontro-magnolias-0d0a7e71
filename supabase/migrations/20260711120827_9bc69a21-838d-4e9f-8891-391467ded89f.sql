
CREATE TABLE public.sync_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  finalizado_em timestamptz,
  duracao_ms integer,
  origem text NOT NULL DEFAULT 'cron',
  sucesso boolean NOT NULL DEFAULT false,
  total integer NOT NULL DEFAULT 0,
  criadas integer NOT NULL DEFAULT 0,
  atualizadas integer NOT NULL DEFAULT 0,
  ignoradas integer NOT NULL DEFAULT 0,
  erros integer NOT NULL DEFAULT 0,
  erro_mensagem text,
  http_status integer,
  detalhes jsonb
);

GRANT SELECT ON public.sync_runs TO authenticated;
GRANT ALL ON public.sync_runs TO service_role;

ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins leem sync_runs"
ON public.sync_runs
FOR SELECT
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX sync_runs_iniciado_em_idx ON public.sync_runs (iniciado_em DESC);
