ALTER TABLE public.inscricoes
  ADD COLUMN IF NOT EXISTS cakto_order_id text,
  ADD COLUMN IF NOT EXISTS cakto_payload jsonb;
CREATE INDEX IF NOT EXISTS inscricoes_cakto_order_id_idx ON public.inscricoes (cakto_order_id);