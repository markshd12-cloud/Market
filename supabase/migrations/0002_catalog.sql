-- =============================================================================
-- 0002 · Catálogo do jogo (itens, receitas, locais) e constantes editáveis
-- Leitura: qualquer usuário logado. Escrita: só administradores da plataforma.
-- Rodar no Supabase: SQL Editor → colar → Run. É idempotente.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------------------------
-- Administradores da plataforma (cuidam do catálogo e das constantes)
-- -----------------------------------------------------------------------------
create table if not exists public.platform_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
alter table public.platform_admins force row level security;
revoke all on public.platform_admins from anon, authenticated;
grant select on public.platform_admins to authenticated;

drop policy if exists "platform_admins: ver a própria linha" on public.platform_admins;
create policy "platform_admins: ver a própria linha"
  on public.platform_admins for select
  to authenticated
  using ((select auth.uid()) = user_id);
-- Sem policy de escrita: admin só é concedido pelo SQL Editor.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- -----------------------------------------------------------------------------
-- Itens (um por ID de mercado: T6_MAIN_MACE, T6_MAIN_MACE@1, ...)
-- -----------------------------------------------------------------------------
create table if not exists public.items (
  id               text primary key,          -- ID usado pela API de preços
  base_id          text not null,             -- sem o sufixo @n
  kind             text not null,             -- weapon, equipmentitem, simpleitem...
  tier             smallint,
  enchant          smallint not null default 0,
  name_pt          text,
  name_en          text,
  shop_category    text,
  shop_subcategory text,
  shop_subcategory2 text,
  crafting_category text,
  weight           numeric,
  max_quality      smallint,
  updated_at       timestamptz not null default now()
);

create index if not exists items_base_idx on public.items (base_id);
create index if not exists items_category_idx on public.items (shop_category, shop_subcategory);
create index if not exists items_tier_idx on public.items (tier, enchant);
create index if not exists items_name_pt_trgm on public.items using gin (name_pt extensions.gin_trgm_ops);
create index if not exists items_id_trgm on public.items using gin (id extensions.gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- Receitas (um item pode ter mais de uma variante de receita)
-- -----------------------------------------------------------------------------
create table if not exists public.recipes (
  item_id         text not null references public.items (id) on delete cascade,
  variant         smallint not null default 0,
  silver          integer not null default 0,
  crafting_focus  integer,
  amount_crafted  integer not null default 1,
  craft_time      numeric,
  primary key (item_id, variant)
);

create table if not exists public.recipe_ingredients (
  item_id           text not null,
  variant           smallint not null,
  resource_id       text not null,             -- ID de mercado do ingrediente
  count             integer not null,
  max_return_amount integer,                   -- 0 = não volta na taxa de retorno
  primary key (item_id, variant, resource_id),
  foreign key (item_id, variant) references public.recipes (item_id, variant) on delete cascade
);

create index if not exists recipe_ingredients_resource_idx on public.recipe_ingredients (resource_id);

-- -----------------------------------------------------------------------------
-- Locais de mercado (nomes exatos da API do Albion Data Project)
-- -----------------------------------------------------------------------------
create table if not exists public.locations (
  id         text primary key,                 -- ex.: 'Fort Sterling', 'Black Market'
  name       text not null,
  kind       text not null check (kind in ('royal', 'caerleon', 'black_market', 'brecilien', 'other')),
  zone       text not null check (zone in ('safe', 'red', 'black', 'mists')),
  sort_order smallint not null default 0,
  active     boolean not null default true
);

insert into public.locations (id, name, kind, zone, sort_order) values
  ('Martlock',      'Martlock',      'royal',        'safe', 1),
  ('Bridgewatch',   'Bridgewatch',   'royal',        'safe', 2),
  ('Lymhurst',      'Lymhurst',      'royal',        'safe', 3),
  ('Fort Sterling', 'Fort Sterling', 'royal',        'safe', 4),
  ('Thetford',      'Thetford',      'royal',        'safe', 5),
  ('Caerleon',      'Caerleon',      'caerleon',     'red',  6),
  ('Black Market',  'Black Market',  'black_market', 'red',  7),
  ('Brecilien',     'Brecilien',     'brecilien',    'mists', 8)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Constantes do jogo (nada fixo no código) + histórico de alterações
-- -----------------------------------------------------------------------------
create table if not exists public.game_constants (
  key         text primary key,
  value       numeric not null,
  unit        text not null default '',
  label       text not null,
  description text,
  category    text not null default 'geral',
  status      text not null default 'a_confirmar' check (status in ('confirmado', 'a_confirmar')),
  source      text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null
);

create table if not exists public.game_constants_history (
  id         bigint generated always as identity primary key,
  key        text not null,
  old_value  numeric,
  new_value  numeric,
  old_status text,
  new_status text,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

create or replace function public.log_game_constant_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  if new.value is distinct from old.value or new.status is distinct from old.status then
    insert into public.game_constants_history (key, old_value, new_value, old_status, new_status, changed_by)
    values (old.key, old.value, new.value, old.status, new.status, (select auth.uid()));
  end if;
  return new;
end;
$$;

revoke all on function public.log_game_constant_change() from public, anon, authenticated;

drop trigger if exists game_constants_log on public.game_constants;
create trigger game_constants_log
  before update on public.game_constants
  for each row execute function public.log_game_constant_change();

-- Valores iniciais: referências da comunidade, todos "a confirmar".
insert into public.game_constants (key, value, unit, label, description, category, source) values
  ('market.sales_tax_premium', 4,   '%', 'Taxa de venda (premium)',        'Cobrada sobre o valor vendido, com premium.',            'mercado',  'Comunidade; confirmar no patch atual'),
  ('market.sales_tax_free',    8,   '%', 'Taxa de venda (sem premium)',    'Cobrada sobre o valor vendido, sem premium.',            'mercado',  'Comunidade; confirmar no patch atual'),
  ('market.setup_fee',         2.5, '%', 'Taxa de criar ordem',            'Cobrada ao criar ordem de compra ou de venda.',          'mercado',  'Comunidade; confirmar no patch atual'),
  ('craft.city_base_bonus',    18,  '%', 'Bônus de produção da cidade',    'Bônus base de produção nas cidades reais.',              'producao', 'Comunidade; confirmar'),
  ('craft.city_specialty_bonus', 15, '%', 'Bônus de especialidade da cidade', 'Somado quando a cidade é especialista na categoria.', 'producao', 'Comunidade; confirmar'),
  ('craft.focus_bonus',        59,  '%', 'Bônus de produção com foco',     'Somado ao usar foco no craft/refino.',                   'producao', 'Comunidade; confirmar'),
  ('risk.safety_margin',       10,  '%', 'Folga de segurança',             'Desconto aplicado ao lucro previsto antes de alertar.',  'risco',    'Plano NYX (doc 09)'),
  ('risk.max_volume_share',    35,  '%', 'Venda máx. do volume diário',    'Fração máxima do volume diário vendida por item.',       'risco',    'Plano NYX (doc 09)')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Registro das importações do catálogo
-- -----------------------------------------------------------------------------
create table if not exists public.catalog_imports (
  id           bigint generated always as identity primary key,
  source       text not null,
  source_ref   text,
  items        integer not null default 0,
  recipes      integer not null default 0,
  ingredients  integer not null default 0,
  imported_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- RLS: leitura para logados, escrita só para admin
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['items', 'recipes', 'recipe_ingredients', 'locations', 'game_constants'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);

    execute format('drop policy if exists "%s: leitura" on public.%I', t, t);
    execute format('create policy "%s: leitura" on public.%I for select to authenticated using (true)', t, t);

    execute format('drop policy if exists "%s: admin insere" on public.%I', t, t);
    execute format('create policy "%s: admin insere" on public.%I for insert to authenticated with check ((select public.is_admin()))', t, t);

    execute format('drop policy if exists "%s: admin altera" on public.%I', t, t);
    execute format('create policy "%s: admin altera" on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t, t);

    execute format('drop policy if exists "%s: admin apaga" on public.%I', t, t);
    execute format('create policy "%s: admin apaga" on public.%I for delete to authenticated using ((select public.is_admin()))', t, t);
  end loop;
end
$$;

-- Histórico e importações: só admin lê; escrita pelo gatilho / pelo admin.
alter table public.game_constants_history enable row level security;
alter table public.game_constants_history force row level security;
revoke all on public.game_constants_history from anon, authenticated;
grant select on public.game_constants_history to authenticated;
drop policy if exists "game_constants_history: admin lê" on public.game_constants_history;
create policy "game_constants_history: admin lê"
  on public.game_constants_history for select
  to authenticated
  using ((select public.is_admin()));

alter table public.catalog_imports enable row level security;
alter table public.catalog_imports force row level security;
revoke all on public.catalog_imports from anon, authenticated;
grant select, insert on public.catalog_imports to authenticated;
drop policy if exists "catalog_imports: leitura" on public.catalog_imports;
create policy "catalog_imports: leitura"
  on public.catalog_imports for select
  to authenticated
  using (true);
drop policy if exists "catalog_imports: admin registra" on public.catalog_imports;
create policy "catalog_imports: admin registra"
  on public.catalog_imports for insert
  to authenticated
  with check ((select public.is_admin()));
