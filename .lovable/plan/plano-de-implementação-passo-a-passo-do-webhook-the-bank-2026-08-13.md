# Plano de Implementação: Passo a Passo do Webhook The Bank

O objetivo é adicionar um guia interativo no painel administrativo para ajudar na configuração do webhook na plataforma The Bank, facilitando a validação da sincronização automática de pagamentos.

## Alterações de UI

- **src/pages/Admin.tsx**:
    - Adicionar um novo componente `WebhookSetupGuide` que será exibido na aba "Logs de Webhook".
    - O guia incluirá:
        1. **URL do Webhook**: Exibição clara da URL para copiar.
        2. **Instruções na The Bank**: Passos para colar a URL e selecionar eventos (ex: transação paga).
        3. **Botão de Teste**: Atalho para disparar o teste de webhook e validar a recepção.
        4. **Status de Validação**: Indicador visual se o sistema recebeu eventos reais recentemente.

## Detalhes Técnicos

- Utilizar a lógica já existente no `thebank-webhook-check` para obter a URL correta.
- Melhorar a visibilidade das informações de configuração que hoje ficam "escondidas" nos alertas de erro.
- Adicionar uma seção de "Ajuda e Configuração" expansível para não poluir a interface principal.

## Verificação

- Validar se a URL gerada é a URL pública real da Edge Function.
- Testar o fluxo de cópia da URL.
- Confirmar que o botão de teste integrado ao guia reflete o status corretamente.
