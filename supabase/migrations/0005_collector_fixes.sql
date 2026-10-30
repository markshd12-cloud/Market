-- =============================================================================
-- 0005 · Correções do coletor
--  1. collector_watchlist devolvia linhas e o PostgREST corta em 1.000:
--     passa a devolver um único text[] com a lista inteira.
--  2. O agendador passa a mandar a chave publishable (apikey/Authorization),
--     então funciona mesmo com "Verify JWT" ligado na Edge Function.
--     A chave publishable é pública por definição (vai no JS do site).
-- Rodar no Supabase: SQL Editor → colar → Run. É idempotente.
-- =============================================================================

drop function if exists public.collector_watchlist();

create function public.collector_watchlist()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(id order by id), '{}')
  from (
    select distinct i.id
    from public.items i
    join public.watch_rules r
      on r.enabled
     and r.shop_category = i.shop_category
     and (r.shop_subcategory is null or r.shop_subcategory = i.shop_subcategory)
     and i.tier between r.min_tier and r.max_tier
  ) w;
$$;

revoke all on function public.collector_watchlist() from public, anon, authenticated;
grant execute on function public.collector_watchlist() to service_role;

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
      'apikey', 'sb_publishable_6iABOew-bLm-ufGzA7-byg_cLh4jkjC',
      'Authorization', 'Bearer sb_publishable_6iABOew-bLm-ufGzA7-byg_cLh4jkjC',
      'x-collector-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'collector_secret')
    ),
    body := jsonb_build_object('job', p_job),
    timeout_milliseconds := 140000
  );
$$;

revoke all on function public.collector_invoke(text) from public, anon, authenticated;
