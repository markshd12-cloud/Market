-- =============================================================================
-- 0001 · Perfis de usuário
-- Toda a segurança mora aqui: o app só usa a chave publishable, então cada
-- consulta passa pelo RLS como o próprio usuário.
-- Rodar no Supabase: SQL Editor → colar → Run. É idempotente.
-- =============================================================================

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 32),
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is 'Perfil público de cada usuário do NYX Market.';

-- RLS ligado e forçado (vale até para o dono da tabela).
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

-- Anônimo não enxerga nada; logado só o que as policies liberam.
revoke all on public.profiles from anon;
revoke all on public.profiles from authenticated;
grant select, update on public.profiles to authenticated;

drop policy if exists "profiles: ler o próprio" on public.profiles;
create policy "profiles: ler o próprio"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles: editar o próprio" on public.profiles;
create policy "profiles: editar o próprio"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Sem policy de insert/delete: o perfil nasce pelo gatilho abaixo e morre
-- junto com o usuário (on delete cascade).

-- O usuário só pode mudar nome e avatar (nunca id ou datas).
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Cria o perfil quando um usuário se cadastra
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  nome text := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    split_part(new.email, '@', 1)
  );
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(rpad(nome, 2, '_'), 32))
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Só o próprio Auth dispara esta função.
revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Perfis para usuários que já existiam antes desta migration.
insert into public.profiles (id, display_name)
select u.id,
       left(rpad(coalesce(nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''),
                          split_part(u.email, '@', 1)), 2, '_'), 32)
from auth.users u
on conflict (id) do nothing;
