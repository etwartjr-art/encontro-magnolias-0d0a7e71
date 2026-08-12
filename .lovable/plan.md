# Plano: Reconciliação em Lote no Painel Admin

Implementar uma ação no painel administrativo para reconciliação em lote das inscrições, permitindo recalcular o `valor_liquido` (usando a taxa correta de R$ 40,61 para R$ 44,90) e verificar o status das inscrições que foram importadas ou criadas com dados incorretos.

## Mudanças

### Backend (Edge Functions)

- Criar a Edge Function `reconciliar-inscricoes` que:
  - Busca inscrições que precisam de ajuste (ex: `valor_liquido` zerado ou inconsistente).
  - Recalcula o `valor_liquido` com base no valor bruto (44.90 -> 40.61).
  - Registra o progresso e retorna o total de registros atualizados.

### Frontend

- **src/pages/Admin.tsx**:
  - Adicionar um botão "Reconciliar em Lote" no cabeçalho ou na aba de inscrições.
  - Implementar um modal de confirmação antes de iniciar o processo.
  - Exibir um feedback visual (toast ou loading) durante o processamento.
  - Atualizar a lista de inscrições após a conclusão.

## Detalhes Técnicos

- A taxa de conversão será baseada no valor padrão estabelecido anteriormente (R$ 44,90 bruto -> R$ 40,61 líquido).
- A função terá segurança `security definer` ou verificação de admin para garantir que apenas administradores possam executá-la.
