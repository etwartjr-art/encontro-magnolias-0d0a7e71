-- Permite que administradores insiram novas inscrições manualmente
CREATE POLICY "Admins podem inserir inscrições"
  ON public.inscricoes FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Permite que administradores atualizem inscrições existentes
CREATE POLICY "Admins podem atualizar inscrições"
  ON public.inscricoes FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Permite que administradores excluam inscrições
CREATE POLICY "Admins podem excluir inscrições"
  ON public.inscricoes FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Garantir privilégios para authenticated em UPDATE e DELETE (SELECT e INSERT já tinham)
GRANT UPDATE, DELETE ON public.inscricoes TO authenticated;
