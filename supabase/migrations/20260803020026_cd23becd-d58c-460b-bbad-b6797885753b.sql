CREATE TABLE public.rsvps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  email text NOT NULL,
  presenca text NOT NULL DEFAULT 'sim',
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT rsvps_nome_len CHECK (length(btrim(nome)) BETWEEN 2 AND 120),
  CONSTRAINT rsvps_email_len CHECK (length(btrim(email)) BETWEEN 5 AND 255),
  CONSTRAINT rsvps_presenca_valida CHECK (presenca IN ('sim','nao','talvez'))
);

GRANT INSERT ON public.rsvps TO anon;
GRANT SELECT, INSERT, UPDATE ON public.rsvps TO authenticated;
GRANT ALL ON public.rsvps TO service_role;

ALTER TABLE public.rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Público pode confirmar presença"
ON public.rsvps FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins leem RSVPs"
ON public.rsvps FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins atualizam RSVPs"
ON public.rsvps FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER rsvps_touch
BEFORE UPDATE ON public.rsvps
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();