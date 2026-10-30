-- =============================================================================
-- 0008 · Cenários de projeção (por personagem, privados)
-- Percentuais guardados como fração (0,1 = 10%).
-- Rodar no Supabase: SQL Editor → colar → Run. É idempotente.
-- =============================================================================

create table if not exists public.scenarios (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid(),
  character_id      uuid not null,
  name              text not null check (char_length(trim(name)) between 1 and 40),
  color             text not null default '#a78bfa' check (color ~ '^#[0-9a-fA-F]{6}$'),
  stake_pct         numeric not null default 0.5 check (stake_pct between 0 and 1),
  stake_cap         bigint not null default 10000000 check (stake_cap >= 0),
  rotations_per_day numeric not null default 2 check (rotations_per_day between 0 and 12),
  margin            numeric not null default 0.1 check (margin between -1 and 5),
  margin_sd         numeric not null default 0.07 check (margin_sd between 0 and 5),
  loss_chance       numeric not null default 0.03 check (loss_chance between 0 and 1),
  fixed_daily       bigint not null default 0 check (fixed_daily >= 0),
  reinvest          numeric not null default 1 check (reinvest between 0 and 1),
  withdraw_weekly   bigint not null default 0 check (withdraw_weekly >= 0),
  sort_order        smallint not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  foreign key (character_id, user_id) references public.characters (id, user_id) on delete cascade
);

create index if not exists scenarios_character_idx on public.scenarios (character_id, sort_order);

drop trigger if exists scenarios_set_updated_at on public.scenarios;
create trigger scenarios_set_updated_at
  before update on public.scenarios
  for each row execute function public.set_updated_at();

alter table public.scenarios enable row level security;
alter table public.scenarios force row level security;
revoke all on public.scenarios from anon, authenticated;
grant select, insert, delete on public.scenarios to authenticated;
grant update (name, color, stake_pct, stake_cap, rotations_per_day, margin, margin_sd, loss_chance,
              fixed_daily, reinvest, withdraw_weekly, sort_order) on public.scenarios to authenticated;

drop policy if exists "scenarios: dono lê" on public.scenarios;
create policy "scenarios: dono lê" on public.scenarios for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "scenarios: dono cria" on public.scenarios;
create policy "scenarios: dono cria" on public.scenarios for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "scenarios: dono altera" on public.scenarios;
create policy "scenarios: dono altera" on public.scenarios for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "scenarios: dono apaga" on public.scenarios;
create policy "scenarios: dono apaga" on public.scenarios for delete to authenticated
  using ((select auth.uid()) = user_id);
