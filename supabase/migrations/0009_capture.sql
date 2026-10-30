-- =============================================================================
-- 0009 · Captura própria (Albion Data Client → NYX, sem passar pela API pública)
-- O client oficial roda com  -i "https://<site>/api/capture/<chave>"  e faz
-- POST de JSON em <url>/marketorders.ingest. A rota do site repassa para
-- capture_ingest(), que confere a chave pessoal (só o hash fica no banco),
-- normaliza e grava em price_latest com source = 'capture'.
-- Rodar no Supabase: SQL Editor → colar → Run. É idempotente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- IDs de mercado do jogo por local (o client manda "LocationId", ex. "3005").
-- Valores da comunidade, "a confirmar" na primeira captura: IDs desconhecidos
-- aparecem no log da página Captura.
-- -----------------------------------------------------------------------------
alter table public.locations add column if not exists market_ids text[] not null default '{}';

update public.locations set market_ids = v.ids
from (values
  ('Thetford',      array['0007']),
  ('Lymhurst',      array['1002']),
  ('Bridgewatch',   array['2004']),
  ('Martlock',      array['3008']),
  ('Fort Sterling', array['4002']),
  ('Caerleon',      array['3005', '3013-Auction2']),
  ('Black Market',  array['3003']),
  ('Brecilien',     array['5003'])
) as v(loc, ids)
where locations.id = v.loc and locations.market_ids = '{}';

insert into public.game_constants (key, value, unit, label, description, category, source) values
  ('capture.price_divisor', 10000, '×', 'Divisor do preço capturado',
   'O jogo manda o preço multiplicado (silver × 10.000). Confirmar com a primeira captura.', 'captura', 'Albion Data Project')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Chaves pessoais: o site mostra a chave uma vez; aqui só fica o SHA-256.
-- -----------------------------------------------------------------------------
create table if not exists public.capture_keys (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label        text not null default 'Meu PC' check (char_length(label) between 1 and 40),
  key_hash     text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  key_prefix   text not null check (char_length(key_prefix) <= 12),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

create index if not exists capture_keys_user_idx on public.capture_keys (user_id);

alter table public.capture_keys enable row level security;
alter table public.capture_keys force row level security;
revoke all on public.capture_keys from anon, authenticated;
grant select, insert, delete on public.capture_keys to authenticated;
grant update (label, revoked_at) on public.capture_keys to authenticated;

drop policy if exists "capture_keys: dono lê" on public.capture_keys;
create policy "capture_keys: dono lê" on public.capture_keys for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "capture_keys: dono cria" on public.capture_keys;
create policy "capture_keys: dono cria" on public.capture_keys for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "capture_keys: dono altera" on public.capture_keys;
create policy "capture_keys: dono altera" on public.capture_keys for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "capture_keys: dono apaga" on public.capture_keys;
create policy "capture_keys: dono apaga" on public.capture_keys for delete to authenticated
  using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- Log dos lotes recebidos (7 dias): mostra o que entrou, o que ficou de fora
-- e uma amostra crua para conferir formato e escala de preço.
-- -----------------------------------------------------------------------------
create table if not exists public.capture_batches (
  id          bigint generated always as identity primary key,
  key_id      uuid not null references public.capture_keys (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  received_at timestamptz not null default now(),
  topic       text not null,
  orders      integer not null default 0,
  accepted    integer not null default 0,
  rows        integer not null default 0,
  skipped     jsonb,
  sample      jsonb
);

create index if not exists capture_batches_key_idx on public.capture_batches (key_id, received_at desc);
create index if not exists capture_batches_user_idx on public.capture_batches (user_id, received_at desc);

alter table public.capture_batches enable row level security;
alter table public.capture_batches force row level security;
revoke all on public.capture_batches from anon, authenticated;
grant select on public.capture_batches to authenticated;
drop policy if exists "capture_batches: dono lê" on public.capture_batches;
create policy "capture_batches: dono lê" on public.capture_batches for select to authenticated
  using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- Ingestão. Pública (anon) de propósito: quem chama é o client do jogo, sem
-- login. A segurança é a chave pessoal (256 bits), o limite por minuto e a
-- validação de cada ordem (item do catálogo, local conhecido, preço sano).
-- -----------------------------------------------------------------------------
create or replace function public.capture_ingest(p_key text, p_topic text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key_id   uuid;
  v_user_id  uuid;
  v_divisor  numeric;
  v_total    integer := 0;
  v_accepted integer := 0;
  v_rows     integer := 0;
  v_skipped  jsonb;
begin
  if p_key is null or char_length(p_key) < 20 or char_length(p_key) > 100 then
    return jsonb_build_object('ok', false, 'error', 'chave');
  end if;

  select k.id, k.user_id into v_key_id, v_user_id
  from public.capture_keys k
  where k.key_hash = encode(extensions.digest(p_key, 'sha256'), 'hex')
    and k.revoked_at is null;
  if v_key_id is null then
    return jsonb_build_object('ok', false, 'error', 'chave');
  end if;

  if (select count(*) from public.capture_batches b
      where b.key_id = v_key_id and b.received_at > now() - interval '1 minute') >= 240 then
    return jsonb_build_object('ok', false, 'error', 'limite');
  end if;

  update public.capture_keys set last_used_at = now() where id = v_key_id;

  -- Por enquanto só ordens de mercado; o resto fica registrado e ignorado.
  if p_topic is distinct from 'marketorders.ingest' then
    insert into public.capture_batches (key_id, user_id, topic, sample)
    values (v_key_id, v_user_id, left(coalesce(p_topic, '?'), 60),
            case when char_length(p_payload::text) <= 4000 then p_payload else '{"truncado": true}'::jsonb end);
    return jsonb_build_object('ok', true, 'ignored', true);
  end if;

  if jsonb_typeof(p_payload -> 'Orders') is distinct from 'array' then
    return jsonb_build_object('ok', false, 'error', 'formato');
  end if;
  v_total := jsonb_array_length(p_payload -> 'Orders');
  if v_total > 2000 then
    return jsonb_build_object('ok', false, 'error', 'grande');
  end if;

  select coalesce(max(value) filter (where key = 'capture.price_divisor'), 10000)
  into v_divisor
  from public.game_constants;

  with raw as (
    select
      o ->> 'ItemTypeId'                                  as item_raw,
      coalesce((o ->> 'EnchantmentLevel')::int, 0)        as ench,
      o ->> 'LocationId'                                  as loc_raw,
      coalesce((o ->> 'QualityLevel')::int, 1)            as quality,
      (o ->> 'UnitPriceSilver')::numeric                  as price_raw,
      lower(o ->> 'AuctionType')                          as kind
    from jsonb_array_elements(p_payload -> 'Orders') o
  ),
  norm as (
    select
      r.*,
      -- "T4_BAG" + encantamento 1 → "T4_BAG@1" (se o jogo já mandar com @, mantém).
      case when r.item_raw like '%@%' or r.ench = 0 then r.item_raw else r.item_raw || '@' || r.ench end as item_id,
      (select l.id from public.locations l
        where exists (select 1 from unnest(l.market_ids) m where ltrim(m, '0') = ltrim(r.loc_raw, '0'))
        limit 1) as location,
      round(r.price_raw / v_divisor)::bigint as price
    from raw r
  ),
  valid as (
    select n.*
    from norm n
    where n.location is not null
      and n.kind in ('offer', 'request')
      and n.quality between 1 and 5
      and n.price > 0 and n.price < 100000000000
      and exists (select 1 from public.items i where i.id = n.item_id)
  ),
  agg as (
    select
      v.item_id, v.location, v.quality::smallint as quality,
      min(v.price) filter (where v.kind = 'offer')   as sell_min,
      max(v.price) filter (where v.kind = 'offer')   as sell_max,
      min(v.price) filter (where v.kind = 'request') as buy_min,
      max(v.price) filter (where v.kind = 'request') as buy_max
    from valid v
    group by 1, 2, 3
  ),
  up as (
    insert into public.price_latest as t (
      item_id, location, quality,
      sell_min, sell_min_at, sell_max, sell_max_at,
      buy_min, buy_min_at, buy_max, buy_max_at, source, updated_at
    )
    select a.item_id, a.location, a.quality,
           a.sell_min, case when a.sell_min is not null then now() end,
           a.sell_max, case when a.sell_max is not null then now() end,
           a.buy_min,  case when a.buy_min  is not null then now() end,
           a.buy_max,  case when a.buy_max  is not null then now() end,
           'capture', now()
    from agg a
    -- Só o lado visto na tela é atualizado (ofertas OU pedidos).
    on conflict (item_id, location, quality) do update set
      sell_min = coalesce(excluded.sell_min, t.sell_min), sell_min_at = coalesce(excluded.sell_min_at, t.sell_min_at),
      sell_max = coalesce(excluded.sell_max, t.sell_max), sell_max_at = coalesce(excluded.sell_max_at, t.sell_max_at),
      buy_min  = coalesce(excluded.buy_min,  t.buy_min),  buy_min_at  = coalesce(excluded.buy_min_at,  t.buy_min_at),
      buy_max  = coalesce(excluded.buy_max,  t.buy_max),  buy_max_at  = coalesce(excluded.buy_max_at,  t.buy_max_at),
      source = 'capture', updated_at = now()
    returning 1
  )
  select
    (select count(*) from valid),
    (select count(*) from up),
    jsonb_strip_nulls(jsonb_build_object(
      'local_desconhecido', (select jsonb_agg(x) from (select distinct n.loc_raw as x from norm n where n.location is null limit 10) s),
      'item_desconhecido',  (select jsonb_agg(x) from (select distinct n.item_id as x from norm n
                              where n.location is not null and not exists (select 1 from public.items i where i.id = n.item_id) limit 10) s),
      'tipo_desconhecido',  (select jsonb_agg(x) from (select distinct n.kind as x from norm n where n.kind not in ('offer', 'request') limit 5) s)
    ))
  into v_accepted, v_rows, v_skipped;

  insert into public.capture_batches (key_id, user_id, topic, orders, accepted, rows, skipped, sample)
  values (v_key_id, v_user_id, p_topic, v_total, v_accepted, v_rows,
          nullif(v_skipped, '{}'::jsonb), p_payload -> 'Orders' -> 0);

  -- Faxina de vez em quando (log de 7 dias).
  if random() < 0.02 then
    delete from public.capture_batches where received_at < now() - interval '7 days';
  end if;

  return jsonb_build_object('ok', true, 'orders', v_total, 'accepted', v_accepted, 'rows', v_rows);
end;
$$;

revoke all on function public.capture_ingest(text, text, jsonb) from public;
grant execute on function public.capture_ingest(text, text, jsonb) to anon, authenticated;
