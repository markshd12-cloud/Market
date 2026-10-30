-- =============================================================================
-- 0006 · Motor de oportunidades (flip / transporte / Black Market)
-- Cruza o último preço de cada local e devolve as rotas com lucro líquido,
-- quantidade sugerida e nota de confiança. Roda como o usuário (RLS normal).
-- Rodar no Supabase: SQL Editor → colar → Run. É idempotente.
-- =============================================================================

-- Parâmetros do motor: editáveis em Administração, como as outras constantes.
insert into public.game_constants (key, value, unit, label, description, category, source) values
  ('opp.max_age_hours',   6,        'h',      'Idade máx. do preço',         'Preço mais velho que isso não entra no cálculo de rotas.',          'oportunidades', 'Plano NYX'),
  ('opp.min_margin',      5,        '%',      'Margem mín. da rota',         'Margem líquida mínima (depois de taxas) para listar a rota.',      'oportunidades', 'Plano NYX'),
  ('opp.min_confidence',  40,       'pts',    'Confiança mín.',              'Nota de 0 a 100 abaixo da qual a rota não aparece.',               'oportunidades', 'Plano NYX'),
  ('opp.max_capital',     10000000, 'silver', 'Capital por rotação',         'Teto investido por item numa rotação (doc 09: até 10M).',          'oportunidades', 'Plano NYX (doc 09)')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Modos
--   instant: compra na menor ordem de venda da origem e vende na hora para a
--            maior ordem de compra do destino (só taxa de venda).
--   order:   compra na origem e cria ordem de venda no destino pelo menor preço
--            de lá (taxa de criar ordem + taxa de venda; depende de volume).
-- Confiança (0–100) = 40% idade do dado + 30% recorrência de venda no destino
--   (dias com venda nos últimos 30) + 30% sanidade (preços perto da média de
--   7 dias; ordem "lixo" de 3 silver ou ordem troll zera esse pedaço).
-- -----------------------------------------------------------------------------
drop function if exists public.market_opportunities(text, text, text, text, smallint, numeric, numeric, numeric, bigint, boolean, text, integer);

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
  p_limit          integer  default 100
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
  ),
  -- Origem: menor ordem de venda fresca (Black Market não vende para jogador).
  src as (
    select p.item_id, p.quality, p.location, p.sell_min as price, p.sell_min_at as at
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
           case when p_mode = 'order' then p.sell_min_at else p.buy_max_at end as at
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

revoke all on function public.market_opportunities(text, text, text, text, smallint, numeric, numeric, numeric, bigint, boolean, text, integer) from public, anon;
grant execute on function public.market_opportunities(text, text, text, text, smallint, numeric, numeric, numeric, bigint, boolean, text, integer) to authenticated;
