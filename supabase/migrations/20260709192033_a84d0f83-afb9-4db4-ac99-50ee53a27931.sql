
-- 1) Move has_role para schema privado (não exposto pela Data API)
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

-- Recria a função em private
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
-- Concede execução: necessária para políticas RLS avaliadas como authenticated
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 2) Recria políticas que usam has_role apontando para private.has_role
DROP POLICY IF EXISTS "Admins leem inscrições" ON public.inscricoes;
CREATE POLICY "Admins leem inscrições" ON public.inscricoes
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins leem logs greenn" ON public.greenn_webhook_logs;
CREATE POLICY "Admins leem logs greenn" ON public.greenn_webhook_logs
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can view all subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

-- 3) Remove has_role público (já não é referenciado por nenhuma policy)
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- 4) Substitui a política INSERT "sempre verdadeira" do formulário de oração
--    por uma validação mínima de campos obrigatórios.
DROP POLICY IF EXISTS "Anyone can submit a subscription" ON public.subscriptions;
CREATE POLICY "Anyone can submit a subscription" ON public.subscriptions
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(btrim(full_name)) BETWEEN 2 AND 120
    AND length(btrim(phone)) BETWEEN 8 AND 20
  );
