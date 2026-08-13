# Plano de Sincronização Periódica - The Bank

Implementar uma sincronização automática que verifique o status das inscrições pendentes diretamente na API do The Bank, garantindo que pagamentos sejam processados mesmo se o webhook falhar.

## Alterações

### Backend (Edge Functions)
- Criar a Edge Function `sync-thebank-payments` para:
    - Buscar inscrições com status `pendente` no banco de dados.
    - Consultar a API do The Bank para cada e-mail pendente.
    - Atualizar o status para `pago` e definir o `valor_liquido` (R$ 40,61 por padrão) caso o pagamento seja confirmado.
- Configurar o agendamento automático via **pg_cron** para executar a função a cada 1 hora.

### Infraestrutura
- Adicionar segredo `THEBANK_API_KEY` para autenticação com o provedor.
- Adicionar segredo `SYNC_CRON_SECRET` para proteger a execução da função de sincronização.

### Frontend
- Nenhuma alteração visual necessária (o processo será automático em segundo plano).

## Detalhes Técnicos
- Endpoint: `https://api.thebank.com.br/v1/transactions` (ou equivalente conforme documentação).
- Verificação de segurança na Edge Function via token secreto.
- Logs de execução registrados no console do backend.
