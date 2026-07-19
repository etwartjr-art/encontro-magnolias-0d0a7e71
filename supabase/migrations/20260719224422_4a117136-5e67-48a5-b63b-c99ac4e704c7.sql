
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Admins can view magnolias files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'magnolias' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can upload magnolias files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'magnolias' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update magnolias files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'magnolias' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'magnolias' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete magnolias files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'magnolias' AND public.has_role(auth.uid(), 'admin'));
