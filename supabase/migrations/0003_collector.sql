-- =============================================================================
-- 0003 · Coletor de preços (Albion Data Project → Supabase)
-- Usuários logados leem; só o coletor (Edge Function com chave de serviço)
-- escreve, por meio das funções ingest_*.
-- Rodar no Supabase: SQL Editor → colar → Run. É idempotente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- O que vigiar (editável): regras por categoria/subcategoria e faixa de tier
-- -----------------------------------------------------------------------------
create table if not exists public.watch_rules (
  id               bigint generated always as identity primary key,
  shop_category    text not null,
  shop_subcategory text,
  min_tier         smallint not null default 1,
  max_tier         smallint not null default 8,
  enabled          boolean not null default true,
  note             text,
  unique nulls not distinct (shop_category, shop_subcategory)
);

insert into public.watch_rules (shop_category, shop_subcategory, min_tier, max_tier, note) values
  ('weapons',     null,               4, 8, 'Equipamento: Black Market e transporte'),
  ('offhands',    null,               4, 8, null),
  ('head',        null,               4, 8, null),
  ('armors',      null,               4, 8, null),
  ('shoes',       null,               4, 8, null),
  ('capes',       null,               4, 8, null),
  ('bags',        null,               4, 8, null),
  ('artefacts',   null,               4, 8, 'Custo de craft de armas de artefato'),
  ('mounts',      null,               3, 8, null),
  ('consumables', 'potions',          1, 8, 'Poções (craft)'),
  ('consumables', 'food',             1, 8, 'Comida (craft)'),
  ('crafting',    'refinedresources', 2, 8, 'Barras, tábuas, tecidos, couros, blocos'),
  ('crafting',    'alchemy',          1, 8, 'Extratos de alquimia'),
  ('crafting',    'resources',        1, 8, 'Ingredientes de poção/comida'),
  ('gathering',   'ore',              2, 8, null),
  ('gathering',   'wood',             2, 8, null),
  ('gathering',   'fiber',            2, 8, null),
  ('gathering',   'hide',             2, 8, null),
  ('gathering',   'rock',             2, 8, null),
  ('farming',     null,               1, 8, 'Sementes, filhotes, colheitas'),
  ('other',       'labourers',        2, 8, 'Diários de trabalhador')
on conflict do nothing;

-- Lista ordenada de IDs vigiados (o coletor percorre em lotes).
create or replace function public.collector_watchlist()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select distinct i.id
  from public.items i
  join public.watch_rules r
    on r.enabled
   and r.shop_category = i.shop_category
   and (r.shop_subcategory is null or r.shop_subcategory = i.shop_subcategory)
   and i.tier between r.min_tier and r.max_tier
  order by i.id;
$$;

-- -----------------------------------------------------------------------------
-- Último preço por item × local × qualidade (cache de trabalho, não acumula)
-- -----------------------------------------------------------------------------
create table if not exists public.price_latest (
  item_id     text not null,
  location    text not null,
  quality     smallint not null,
  sell_min    bigint,
  sell_min_at timestamptz,
  sell_max    bigint,
  sell_max_at timestamptz,
  buy_min     bigint,
  buy_min_at  timestamptz,
  buy_max     bigint,
  buy_max_at  timestamptz,
  source      text not null default 'api' check (source in ('api', 'capture')),
  updated_at  timestamptz not null default now(),
  primary key (item_id, location, quality)
);

create index if not exists price_latest_location_idx on public.price_latest (location, item_id);

-- -----------------------------------------------------------------------------
-- Estatísticas do histórico diário (volume e preço médio)
-- -----------------------------------------------------------------------------
create table if not exists public.market_stats (
  item_id        text not null,
  location       text not null,
  quality        smallint not null,
  volume_7d      numeric not null default 0,   -- média de itens vendidos por dia
  volume_30d     numeric not null default 0,
  price_7d       numeric,                      -- preço médio ponderado pelo volume
  price_30d      numeric,
  days_sold_30d  smallint not null default 0,  -- dias com venda nos últimos 30
  last_day       date,
  updated_at     timestamptz not null default now(),
  primary key (item_id, location, quality)
);

-- -----------------------------------------------------------------------------
-- Estado e execuções do coletor
-- -----------------------------------------------------------------------------
create table if not exists public.collector_state (
  job          text primary key check (job in ('prices', 'history')),
  cursor       integer not null default 0,
  cycle        integer not null default 0,
  last_run_at  timestamptz,
  last_ok_at   timestamptz,
  last_error   text
);

insert into public.collector_state (job) values ('prices'), ('history') on conflict do nothing;

create table if not exists public.collector_runs (
  id            bigint generated always as identity primary key,
  job           text not null,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  requests      integer not null default 0,
  rows          integer not null default 0,
  ok            boolean,
  message       text
);

create index if not exists collector_runs_started_idx on public.collector_runs (started_at desc);

-- -----------------------------------------------------------------------------
-- Ingestão (só o coletor chama). Só grava quando algo mudou.
-- -----------------------------------------------------------------------------
create or replace function public.ingest_prices(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  insert into public.price_latest as t (
    item_id, location, quality,
    sell_min, sell_min_at, sell_max, sell_max_at,
    buy_min, buy_min_at, buy_max, buy_max_at, source, updated_at
  )
  select r.item_id, r.location, r.quality,
         r.sell_min, r.sell_min_at, r.sell_max, r.sell_max_at,
         r.buy_min, r.buy_min_at, r.buy_max, r.buy_max_at, 'api', now()
  from jsonb_to_recordset(p_rows) as r(
    item_id text, location text, quality smallint,
    sell_min bigint, sell_min_at timestamptz, sell_max bigint, sell_max_at timestamptz,
    buy_min bigint, buy_min_at timestamptz, buy_max bigint, buy_max_at timestamptz
  )
  on conflict (item_id, location, quality) do update set
    sell_min = excluded.sell_min, sell_min_at = excluded.sell_min_at,
    sell_max = excluded.sell_max, sell_max_at = excluded.sell_max_at,
    buy_min = excluded.buy_min, buy_min_at = excluded.buy_min_at,
    buy_max = excluded.buy_max, buy_max_at = excluded.buy_max_at,
    source = 'api', updated_at = now()
  -- Não sobrescreve captura própria mais nova nem regrava o que não mudou.
  where greatest(excluded.sell_min_at, excluded.buy_max_at, excluded.sell_max_at, excluded.buy_min_at)
        > coalesce(greatest(t.sell_min_at, t.buy_max_at, t.sell_max_at, t.buy_min_at), '-infinity');
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.ingest_market_stats(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  insert into public.market_stats as t (
    item_id, location, quality, volume_7d, volume_30d, price_7d, price_30d, days_sold_30d, last_day, updated_at
  )
  select r.item_id, r.location, r.quality, r.volume_7d, r.volume_30d, r.price_7d, r.price_30d,
         r.days_sold_30d, r.last_day, now()
  from jsonb_to_recordset(p_rows) as r(
    item_id text, location text, quality smallint, volume_7d numeric, volume_30d numeric,
    price_7d numeric, price_30d numeric, days_sold_30d smallint, last_day date
  )
  on conflict (item_id, location, quality) do update set
    volume_7d = excluded.volume_7d, volume_30d = excluded.volume_30d,
    price_7d = excluded.price_7d, price_30d = excluded.price_30d,
    days_sold_30d = excluded.days_sold_30d, last_day = excluded.last_day, updated_at = now()
  where t.last_day is distinct from excluded.last_day
     or t.volume_30d is distinct from excluded.volume_30d;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- Mantém só 7 dias de log de execuções.
create or replace function public.collector_cleanup()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.collector_runs where started_at < now() - interval '7 days';
$$;

-- Funções do coletor: ninguém além da chave de serviço executa.
revoke all on function public.collector_watchlist() from public, anon, authenticated;
revoke all on function public.ingest_prices(jsonb) from public, anon, authenticated;
revoke all on function public.ingest_market_stats(jsonb) from public, anon, authenticated;
revoke all on function public.collector_cleanup() from public, anon, authenticated;
grant execute on function public.collector_watchlist() to service_role;
grant execute on function public.ingest_prices(jsonb) to service_role;
grant execute on function public.ingest_market_stats(jsonb) to service_role;
grant execute on function public.collector_cleanup() to service_role;

-- -----------------------------------------------------------------------------
-- RLS: logados leem; escrita só pelo coletor (service_role ignora RLS)
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['price_latest', 'market_stats', 'collector_state', 'collector_runs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('drop policy if exists "%s: leitura" on public.%I', t, t);
    execute format('create policy "%s: leitura" on public.%I for select to authenticated using (true)', t, t);
  end loop;
end
$$;

-- Regras de vigia: logados leem, admin edita (mesmo padrão do catálogo).
alter table public.watch_rules enable row level security;
alter table public.watch_rules force row level security;
revoke all on public.watch_rules from anon, authenticated;
grant select, insert, update, delete on public.watch_rules to authenticated;
drop policy if exists "watch_rules: leitura" on public.watch_rules;
create policy "watch_rules: leitura" on public.watch_rules for select to authenticated using (true);
drop policy if exists "watch_rules: admin edita" on public.watch_rules;
create policy "watch_rules: admin edita" on public.watch_rules for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
