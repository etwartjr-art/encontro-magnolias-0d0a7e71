-- Adiciona a coluna valor_liquido se ela ainda não existir
ALTER TABLE public.inscricoes ADD COLUMN IF NOT EXISTS valor_liquido numeric(10,2);

-- Inicializa o valor_liquido para registros existentes
-- Para os registros de R$ 44,90, o líquido é R$ 41,56 (aproximadamente, baseado na taxa anterior de 36.90/39.90 = 0.9248)
-- Ou mantendo a lógica anterior onde 36.90 era o líquido de 39.90
UPDATE public.inscricoes 
SET valor_liquido = CASE 
  WHEN valor = 44.90 THEN 41.56
  WHEN valor = 39.90 THEN 36.90
  ELSE valor * 0.925 -- Estimativa genérica
END
WHERE valor_liquido IS NULL;

-- Garante que o valor_liquido não seja nulo em inserções futuras (opcional, mas bom para consistência)
ALTER TABLE public.inscricoes ALTER COLUMN valor_liquido SET DEFAULT 0;
