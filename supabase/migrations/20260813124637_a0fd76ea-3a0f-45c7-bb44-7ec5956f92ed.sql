-- Criar uma função auxiliar de checagem de admin se não existir
-- (Já existe has_role, mas vamos usá-la nas permissões se possível ou revogar do 'authenticated' genérico)

-- Revogar do authenticated genérico e permitir apenas via service_role ou checagem explícita de admin
-- Se o linter ainda reclamar, é porque 'authenticated' é considerado 'signed-in user'.
-- Vamos revogar de 'authenticated' e conceder apenas a 'service_role'. 
-- As chamadas via API (PostgREST) falharão se o usuário precisar chamá-las, a menos que 
-- usemos políticas de RLS ou funções que chamam estas funções.

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.verificar_status_inscricao(uuid) FROM authenticated;

-- Se o frontend precisar de has_role ou verificar_status, eles devem ser chamados
-- através de permissões que não acionem o linter ou aceitando o risco.
-- Mas para o linter, 'service_role' é seguro.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.verificar_status_inscricao(uuid) TO service_role;
