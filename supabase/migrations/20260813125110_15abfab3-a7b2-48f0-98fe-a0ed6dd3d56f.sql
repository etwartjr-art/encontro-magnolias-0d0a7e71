UPDATE public.inscricoes
SET status = 'pago',
    pago_em = COALESCE(pago_em, now()),
    metodo_pagamento = COALESCE(metodo_pagamento, 'thebank'),
    valor_liquido = 40.61
WHERE status = 'pendente'
  AND lower(btrim(email)) IN (
    's.dressadeus@gmail.com',
    'fernandavalverde29@gmail.com',
    'prietojoelma@gmail.com',
    'mortozarosangela@gmail.com'
  );

-- Heidy possui duas inscrições pendentes e apenas um pagamento aprovado
UPDATE public.inscricoes
SET status = 'pago',
    pago_em = COALESCE(pago_em, now()),
    metodo_pagamento = COALESCE(metodo_pagamento, 'thebank'),
    valor_liquido = 40.61
WHERE id = (
  SELECT id FROM public.inscricoes
  WHERE lower(btrim(email)) = 'heidylyana@gmail.com' AND status = 'pendente'
  ORDER BY criado_em ASC
  LIMIT 1
);