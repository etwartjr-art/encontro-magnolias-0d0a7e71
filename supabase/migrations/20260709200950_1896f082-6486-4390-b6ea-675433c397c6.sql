REVOKE EXECUTE ON FUNCTION public.verificar_status_inscricao(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verificar_status_inscricao(uuid) TO service_role;