-- Garantir que a extensão existe
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Agendar o job (o pg_cron gerencia o conflito se o jobname já existir dependendo da versão, 
-- mas aqui usamos um bloco anônimo para garantir limpeza)
DO $$
BEGIN
    PERFORM cron.unschedule('sync-thebank-payments-job');
EXCEPTION WHEN OTHERS THEN
    -- Ignorar se o job não existir
END $$;

SELECT cron.schedule(
  'sync-thebank-payments-job',
  '0 * * * *',
  'SELECT net.http_post(url := current_setting(''app.settings.supabase_url'') || ''/functions/v1/sync-thebank-payments'', headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', ''Bearer '' || current_setting(''app.settings.service_role_key'')), body := ''{}'')'
);
