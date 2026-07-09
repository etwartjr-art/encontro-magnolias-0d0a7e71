
CREATE INDEX IF NOT EXISTS inscricoes_celular_idx ON public.inscricoes (celular);
CREATE INDEX IF NOT EXISTS inscricoes_email_idx ON public.inscricoes (email);
CREATE UNIQUE INDEX IF NOT EXISTS inscricoes_greenn_sale_id_idx
  ON public.inscricoes (greenn_sale_id) WHERE greenn_sale_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.verificar_status_inscricao(p_id uuid)
RETURNS TABLE (status inscricao_status, nome text, valor numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status, nome, valor
  FROM public.inscricoes
  WHERE id = p_id;
$$;

REVOKE ALL ON FUNCTION public.verificar_status_inscricao(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.verificar_status_inscricao(uuid) TO anon, authenticated;
