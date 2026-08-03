DROP POLICY "Público pode confirmar presença" ON public.rsvps;

CREATE POLICY "Público pode confirmar presença"
ON public.rsvps FOR INSERT TO anon, authenticated
WITH CHECK (
  length(btrim(nome)) BETWEEN 2 AND 120
  AND btrim(email) ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND length(btrim(email)) <= 255
  AND presenca IN ('sim','nao','talvez')
);