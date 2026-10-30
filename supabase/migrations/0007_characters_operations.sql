-- =============================================================================
-- 0007 · Personagens, operações e banco
-- Finanças são privadas: cada usuário só enxerga e altera o que é dele.
-- A operação aponta para (personagem, dono) com FK composta, então ninguém
-- consegue lançar operação no personagem de outro.
-- Rodar no Supabase: SQL Editor → colar → Run. É idempotente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Personagens (um login pode ter vários) + meta de cada um
-- -----------------------------------------------------------------------------
create table if not exists public.characters (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null check (char_length(trim(name)) between 2 and 32),
  premium       boolean not null default true,
  home_city     text references public.locations (id) on delete set null,
  goal_amount   bigint check (goal_amount > 0),
  goal_days     smallint check (goal_days between 1 and 365),
  goal_start    date not null default current_date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id)            -- alvo da FK composta das tabelas abaixo
);

drop trigger if exists characters_set_updated_at on public.characters;
create trigger characters_set_updated_at
  before update on public.characters
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Operações: compra numa ponta, venda (ou perda) na outra
-- -----------------------------------------------------------------------------
create table if not exists public.operations (
  id              bigint generated always as identity primary key,
  user_id         uuid not null default auth.uid(),
  character_id    uuid not null,
  item_id         text not null references public.items (id),
  quality         smallint not null default 1 check (quality between 1 and 5),
  quantity        integer not null check (quantity > 0),
  buy_location    text references public.locations (id) on delete set null,
  buy_price       bigint not null check (buy_price >= 0),          -- por unidade
  sell_location   text references public.locations (id) on delete set null,
  sell_price      bigint check (sell_price >= 0),                  -- por unidade
  sale_mode       text not null default 'instant' check (sale_mode in ('instant', 'order')),
  fees            bigint not null default 0 check (fees >= 0),     -- total pago em taxas
  expected_profit bigint,                                          -- o que o motor previu
  status          text not null default 'aberta' check (status in ('aberta', 'vendida', 'perdida')),
  opened_at       timestamptz not null default now(),
  closed_at       timestamptz,
  note            text check (char_length(note) <= 280),
  -- Lucro realizado: só existe depois de fechada.
  profit          bigint generated always as (
    case status
      when 'vendida' then coalesce(sell_price, 0) * quantity - fees - buy_price * quantity
      when 'perdida' then -(buy_price * quantity) - fees
    end
  ) stored,
  foreign key (character_id, user_id) references public.characters (id, user_id) on delete cascade,
  check (status = 'aberta' or closed_at is not null),
  check (status <> 'vendida' or sell_price is not null)
);

create index if not exists operations_character_idx on public.operations (character_id, status, opened_at desc);

-- -----------------------------------------------------------------------------
-- Banco informado pelo jogador (o jogo não expõe saldo). O "banco atual" é o
-- último registro + lucro das operações fechadas depois dele.
-- -----------------------------------------------------------------------------
create table if not exists public.balance_snapshots (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid(),
  character_id uuid not null,
  balance      bigint not null check (balance >= 0),
  taken_at     timestamptz not null default now(),
  note         text check (char_length(note) <= 120),
  foreign key (character_id, user_id) references public.characters (id, user_id) on delete cascade
);

create index if not exists balance_snapshots_character_idx on public.balance_snapshots (character_id, taken_at desc);

-- -----------------------------------------------------------------------------
-- RLS: só o dono. user_id nasce de auth.uid() e não pode ser alterado.
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['characters', 'operations', 'balance_snapshots'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, delete on public.%I to authenticated', t);

    execute format('drop policy if exists "%s: dono lê" on public.%I', t, t);
    execute format('create policy "%s: dono lê" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t, t);
    execute format('drop policy if exists "%s: dono cria" on public.%I', t, t);
    execute format('create policy "%s: dono cria" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t, t);
    execute format('drop policy if exists "%s: dono altera" on public.%I', t, t);
    execute format('create policy "%s: dono altera" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t, t);
    execute format('drop policy if exists "%s: dono apaga" on public.%I', t, t);
    execute format('create policy "%s: dono apaga" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t, t);
  end loop;
end
$$;

-- Update só nas colunas editáveis (nunca id, user_id, datas de criação).
grant update (name, premium, home_city, goal_amount, goal_days, goal_start) on public.characters to authenticated;
grant update (quality, quantity, buy_location, buy_price, sell_location, sell_price, sale_mode, fees,
              status, closed_at, note) on public.operations to authenticated;
grant update (balance, taken_at, note) on public.balance_snapshots to authenticated;
