-- A função has_role precisa ser executável por usuários autenticados para que as políticas RLS funcionem
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

-- Garantir que o tipo app_role também seja acessível
GRANT USAGE ON TYPE public.app_role TO authenticated;
GRANT USAGE ON TYPE public.app_role TO service_role;
