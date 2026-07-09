REVOKE EXECUTE ON FUNCTION public.verificar_status_inscricao(uuid) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.verificar_status_inscricao(uuid) TO service_role;