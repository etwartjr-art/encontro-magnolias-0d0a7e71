-- Revogar execução pública de funções críticas
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

-- Se houver outras funções SECURITY DEFINER conhecidas, podemos listar aqui.
-- O aviso do linter geralmente se refere a funções que o Supabase/usuário criou que o anon/authenticated podem chamar.
