ALTER TABLE public.inscricoes ADD COLUMN IF NOT EXISTS thebank_id TEXT;
ALTER TABLE public.inscricoes ADD COLUMN IF NOT EXISTS thebank_payload JSONB;
ALTER TABLE public.inscricoes ADD COLUMN IF NOT EXISTS comprovante_url TEXT;

CREATE INDEX IF NOT EXISTS inscricoes_thebank_id_idx ON public.inscricoes(thebank_id);