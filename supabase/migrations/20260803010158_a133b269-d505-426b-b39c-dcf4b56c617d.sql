DROP TABLE IF EXISTS public.greenn_webhook_logs;
DROP TABLE IF EXISTS public.sync_runs;
DROP POLICY IF EXISTS "Público cria inscrição pendente" ON public.inscricoes;
ALTER TABLE public.inscricoes
  DROP COLUMN IF EXISTS greenn_sale_id,
  DROP COLUMN IF EXISTS greenn_payload;
CREATE POLICY "Público cria inscrição pendente"
  ON public.inscricoes FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'pendente'::inscricao_status AND pago_em IS NULL);