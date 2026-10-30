-- =============================================================================
-- 0004 · Agenda do coletor (pg_cron + pg_net chamando a Edge Function)
--
-- ANTES de rodar:
--   1. Edge Function `collect-prices` publicada (ver README → Coletor).
--   2. Segredo no Vault (rodar UMA vez, com o valor de COLLECTOR_SECRET):
--        select vault.create_secret('VALOR_DO_SEGREDO', 'collector_secret');
-- Idempotente: reagenda se já existir.
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Dispara a Edge Function com o segredo lido do Vault (não fica no texto do job).
create or replace function public.collector_invoke(p_job text)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select net.http_post(
    url := 'https://lnwpkbikmenntkodzkwz.supabase.co/functions/v1/collect-prices',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-collector-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'collector_secret')
    ),
    body := jsonb_build_object('job', p_job),
    timeout_milliseconds := 140000
  );
$$;

revoke all on function public.collector_invoke(text) from public, anon, authenticated;

-- Preços a cada 5 min; volume/preço médio a cada 10 min.
select cron.unschedule(jobid) from cron.job where jobname in ('nyx-prices', 'nyx-history');
select cron.schedule('nyx-prices',  '*/5 * * * *',  $$ select public.collector_invoke('prices') $$);
select cron.schedule('nyx-history', '2-59/10 * * * *', $$ select public.collector_invoke('history') $$);

-- Para pausar:   select cron.unschedule('nyx-prices'); select cron.unschedule('nyx-history');
-- Para conferir: select * from cron.job_run_details order by start_time desc limit 10;
