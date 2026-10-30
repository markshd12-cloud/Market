-- =============================================================================
-- 0010 · "Meu mercado": rotas só com o que EU capturei
-- capture_seen guarda quais itens cada usuário viu no jogo (privado). A
-- captura passa a anotar ali, e market_opportunities ganha p_mine_hours.
-- Rodar no Supabase: SQL Editor → colar → Run. É idempotente.
-- =============================================================================

create table if not exists public.capture_seen (
  user_id  uuid not null references auth.users (id) on delete cascade,
  item_id  text not null,
  location text not null,
  quality  smallint not null,
  seen_at  timestamptz not null default now(),
  primary key (user_id, item_id, location, quality)
);

create index if not exists capture_seen_user_idx on public.capture_seen (user_id, seen_at desc);

alter table public.capture_seen enable row level security;
alter table public.capture_seen force row level security;
revoke all on public.capture_seen from anon, authenticated;
grant select, delete on public.capture_seen to authenticated;
drop policy if exists "capture_seen: dono lê" on public.capture_seen;
create policy "capture_seen: dono lê" on public.capture_seen for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "capture_seen: dono apaga" on public.capture_seen;
create policy "capture_seen: dono apaga" on public.capture_seen for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Retroativo: capturas já gravadas viram do único usuário que capturou até agora.
insert into public.capture_seen (user_id, item_id, location, quality, seen_at)
select u.user_id, p.item_id, p.location, p.quality, p.updated_at
from public.price_latest p
cross join (select distinct user_id from public.capture_batches) u
where p.source = 'capture'
  and (select count(distinct user_id) from public.capture_batches) = 1
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Captura: igual à 0009, mais o registro em capture_seen.
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
  ),
  -- O que ESTE usuário viu no jogo (painel "Meu mercado").
  seen as (
    insert into public.capture_seen as cs (user_id, item_id, location, quality, seen_at)
    select v_user_id, a.item_id, a.location, a.quality, now() from agg a
    on conflict (user_id, item_id, location, quality) do update set seen_at = now()
    returning 1
  )
  select
    (select count(*) from valid),
    (select count(*) from up) + 0 * (select count(*) from seen),
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

-- -----------------------------------------------------------------------------
-- Motor: igual à 0006, mais p_mine_hours e o selo 'sua_captura'.
-- -----------------------------------------------------------------------------
drop function if exists public.market_opportunities(text, text, text, text, smallint, numeric, numeric, numeric, bigint, boolean, text, integer);
drop function if exists public.market_opportunities(text, text, text, text, smallint, numeric, numeric, numeric, bigint, boolean, text, integer, numeric);

create function public.market_opportunities(
  p_mode           text     default 'instant',
  p_origin         text     default null,
  p_dest           text     default null,
  p_category       text     default null,
  p_tier           smallint default null,
  p_max_age_hours  numeric  default null,
  p_min_margin     numeric  default null,   -- em %
  p_min_confidence numeric  default null,
  p_capital        bigint   default null,
  p_premium        boolean  default true,
  p_sort           text     default 'profit', -- profit | margin | confidence | unit
  p_limit          integer  default 100,
  p_mine_hours     numeric  default null    -- só itens que EU capturei nessas horas
)
returns table (
  item_id        text,
  name           text,
  tier           smallint,
  enchant        smallint,
  shop_category  text,
  weight         numeric,
  quality        smallint,
  origin         text,
  dest           text,
  buy_price      bigint,
  buy_at         timestamptz,
  sell_price     bigint,
  sell_at        timestamptz,
  fees_unit      numeric,
  profit_unit    numeric,
  margin         numeric,
  qty            integer,
  profit_total   numeric,
  volume_7d      numeric,
  days_sold_30d  smallint,
  avg_7d_origin  numeric,
  avg_7d_dest    numeric,
  confidence     integer,
  flags          text[]
)
language plpgsql
stable
security invoker
set search_path = ''
-- Os filtros opcionais (p_x is null or ...) só simplificam com o valor real;
-- no plano genérico a consulta ia de ~0,2 s para ~5 s.
set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_column
begin
  return query
  with c as (
    select
      coalesce(p_max_age_hours,  max(value) filter (where key = 'opp.max_age_hours'), 6)        as max_age,
      coalesce(p_min_margin,     max(value) filter (where key = 'opp.min_margin'), 5) / 100     as min_margin,
      coalesce(p_min_confidence, max(value) filter (where key = 'opp.min_confidence'), 40)      as min_conf,
      coalesce(p_capital,        max(value) filter (where key = 'opp.max_capital'), 10000000)   as capital,
      case when p_premium
        then coalesce(max(value) filter (where key = 'market.sales_tax_premium'), 4)
        else coalesce(max(value) filter (where key = 'market.sales_tax_free'), 8)
      end / 100                                                                                  as sales_tax,
      coalesce(max(value) filter (where key = 'market.setup_fee'), 2.5) / 100                   as setup_fee,
      coalesce(max(value) filter (where key = 'risk.safety_margin'), 10) / 100                  as safety,
      coalesce(max(value) filter (where key = 'risk.max_volume_share'), 35) / 100               as vol_share
    from public.game_constants
  ),
  it as (
    select i.id, coalesce(i.name_pt, i.name_en, i.id) as name, i.tier, i.enchant, i.shop_category, i.weight
    from public.items i
    where (p_category is null or i.shop_category = p_category)
      and (p_tier is null or i.tier = p_tier)
      and (p_mine_hours is null or exists (
        select 1 from public.capture_seen cs
        where cs.user_id = (select auth.uid())
          and cs.item_id = i.id
          and cs.seen_at > now() - make_interval(secs => p_mine_hours * 3600)
      ))
  ),
  -- Origem: menor ordem de venda fresca (Black Market não vende para jogador).
  src as (
    select p.item_id, p.quality, p.location, p.sell_min as price, p.sell_min_at as at, p.source
    from public.price_latest p
    join it on it.id = p.item_id
    cross join c
    where p.sell_min > 0
      and p.location <> 'Black Market'
      and (p_origin is null or p.location = p_origin)
      and p.sell_min_at > now() - make_interval(secs => c.max_age * 3600)
  ),
  -- Destino: maior ordem de compra (instant) ou menor ordem de venda (order).
  dst as (
    select p.item_id, p.quality, p.location,
           case when p_mode = 'order' then p.sell_min else p.buy_max end       as price,
           case when p_mode = 'order' then p.sell_min_at else p.buy_max_at end as at,
           p.source
    from public.price_latest p
    join it on it.id = p.item_id
    cross join c
    where (p_dest is null or p.location = p_dest)
      and not (p_mode = 'order' and p.location = 'Black Market')
      and case when p_mode = 'order' then p.sell_min else p.buy_max end > 0
      and case when p_mode = 'order' then p.sell_min_at else p.buy_max_at end
          > now() - make_interval(secs => c.max_age * 3600)
  ),
  pairs as (
    select
      s.item_id, s.quality, s.location as origin, d.location as dest,
      s.price as buy_price, s.at as buy_at, d.price as sell_price, d.at as sell_at,
      (s.source = 'capture' or d.source = 'capture') as captured,
      d.price * (c.sales_tax + case when p_mode = 'order' then c.setup_fee else 0 end) as fees_unit,
      ms_o.price_7d as avg_o, ms_d.price_7d as avg_d,
      ms_d.volume_7d, ms_d.days_sold_30d, ms_o.volume_7d as volume_o,
      extract(epoch from now() - least(s.at, d.at)) / 3600 as age_h,
      c.*
    from src s
    join dst d on d.item_id = s.item_id and d.quality = s.quality and d.location <> s.location
    cross join c
    left join public.market_stats ms_o
      on ms_o.item_id = s.item_id and ms_o.location = s.location and ms_o.quality = s.quality
    left join public.market_stats ms_d
      on ms_d.item_id = d.item_id and ms_d.location = d.location and ms_d.quality = d.quality
    -- Corta cedo o que não paga as taxas + margem mínima (a maioria dos pares).
    where d.price * (1 - c.sales_tax - case when p_mode = 'order' then c.setup_fee else 0 end)
          >= s.price * (1 + c.min_margin)
  ),
  calc as (
    select
      p.*,
      p.sell_price - p.fees_unit - p.buy_price as profit_unit,
      (p.sell_price - p.fees_unit - p.buy_price) / p.buy_price as margin,
      -- Desvio em relação à média de 7 dias (log: 2x e 0,5x pesam igual).
      greatest(
        case when p.avg_o > 0 then abs(ln(p.buy_price / p.avg_o)) end,
        case when p.avg_d > 0 then abs(ln(p.sell_price / p.avg_d)) end
      ) as dev
    from pairs p
  ),
  scored as (
    select
      k.*,
      greatest(0, least(1, 1 - k.age_h / k.max_age)) as s_age,
      coalesce(k.days_sold_30d, 0) / 30.0 as s_recur,
      case
        when k.dev is null then 0.5
        else greatest(0, least(1, 1 - (k.dev - ln(1.3)) / (ln(2.0) - ln(1.3))))
      end as s_sane,
      -- Quanto dá para girar por dia: limitado pelo capital, pelo que o destino
      -- absorve e pelo que a origem vende sem subir o preço.
      greatest(1, least(
        floor(k.capital / k.buy_price),
        coalesce(nullif(floor(k.volume_7d * k.vol_share), 0), 1),
        coalesce(nullif(floor(k.volume_o * k.vol_share), 0), 1e9)
      ))::integer as q
    from calc k
    where k.margin >= k.min_margin
  ),
  final as (
    select
      s.*,
      -- Preço a mais de 2x da média: nota limitada a 35 (some no filtro padrão).
      least(
        round(100 * (0.4 * s.s_age + 0.3 * s.s_recur + 0.3 * s.s_sane)),
        case when s.dev > ln(2.0) then 35 else 100 end
      )::integer as conf,
      s.profit_unit * s.q * (1 - s.safety) as total
    from scored s
  )
  select
    f.item_id, it.name, it.tier, it.enchant, it.shop_category, it.weight, f.quality,
    f.origin, f.dest, f.buy_price, f.buy_at, f.sell_price, f.sell_at,
    round(f.fees_unit), round(f.profit_unit), round(f.margin, 4), f.q, round(f.total),
    f.volume_7d, f.days_sold_30d, round(f.avg_o), round(f.avg_d), f.conf,
    array_remove(array[
      case when f.captured then 'sua_captura' end,
      case when lo.zone in ('red', 'black') or ld.zone in ('red', 'black') then 'zona_vermelha' end,
      case when f.volume_7d is null then 'sem_historico' end,
      case when f.volume_o is null then 'origem_sem_historico' end,
      case when f.dev > ln(2.0) then 'preco_suspeito' end,
      case when f.q >= floor(f.capital / f.buy_price) and f.volume_7d is not null then 'limite_capital' end
    ], null)
  from final f
  join it on it.id = f.item_id
  left join public.locations lo on lo.id = f.origin
  left join public.locations ld on ld.id = f.dest
  where f.conf >= f.min_conf
  order by
    case p_sort
      when 'margin'     then f.margin
      when 'confidence' then f.conf
      when 'unit'       then f.profit_unit
      else f.total
    end desc nulls last,
    f.total desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

revoke all on function public.market_opportunities(text, text, text, text, smallint, numeric, numeric, numeric, bigint, boolean, text, integer, numeric) from public, anon;
grant execute on function public.market_opportunities(text, text, text, text, smallint, numeric, numeric, numeric, bigint, boolean, text, integer, numeric) to authenticated;
