-- ComercialView — rode isto inteiro no SQL Editor do Supabase (uma vez).
-- Modelo de acesso:
--   * Não existe cadastro público: contas só são criadas por um gestor (service role, no servidor).
--   * Cada conta tem um profile com papel (corretor | gestor) e o id de usuário do Pipedrive.
--   * O corretor só lê o próprio profile e as próprias metas. Gestor lê e escreve tudo.
--   * Os dados do Pipedrive nunca passam pelo banco: o servidor filtra pelo pipedrive_user_id
--     do profile — nunca por algo que venha do navegador.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  email text not null,
  role text not null check (role in ('corretor', 'gestor')),
  pipedrive_user_id bigint unique,
  ativo boolean not null default true,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.metas (
  pipedrive_user_id bigint not null,
  mes date not null check (extract(day from mes) = 1),
  meta_vgv numeric(14, 2) not null default 0,
  meta_captacoes integer not null default 4,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  primary key (pipedrive_user_id, mes)
);

alter table public.profiles enable row level security;
alter table public.metas enable row level security;

-- security definer para não entrar em recursão de RLS ao consultar profiles dentro da policy
create or replace function public.is_gestor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'gestor' and ativo
  );
$$;

create or replace function public.my_pipedrive_user_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select pipedrive_user_id from public.profiles where id = auth.uid() and ativo;
$$;

revoke all on function public.is_gestor() from public, anon;
revoke all on function public.my_pipedrive_user_id() from public, anon;
grant execute on function public.is_gestor() to authenticated;
grant execute on function public.my_pipedrive_user_id() to authenticated;

drop policy if exists "profiles: ler o próprio" on public.profiles;
create policy "profiles: ler o próprio" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "profiles: gestor lê todos" on public.profiles;
create policy "profiles: gestor lê todos" on public.profiles
  for select to authenticated using (public.is_gestor());

-- escrita em profiles só pelo servidor com service role (criar conta, trocar papel, desativar).
-- A única coisa que o próprio usuário pode mudar é baixar a flag de troca de senha,
-- e isso também é feito pelo servidor depois de validar a nova senha.

drop policy if exists "metas: corretor lê as próprias" on public.metas;
create policy "metas: corretor lê as próprias" on public.metas
  for select to authenticated using (pipedrive_user_id = public.my_pipedrive_user_id());

drop policy if exists "metas: gestor lê todas" on public.metas;
create policy "metas: gestor lê todas" on public.metas
  for select to authenticated using (public.is_gestor());

drop policy if exists "metas: gestor escreve" on public.metas;
create policy "metas: gestor escreve" on public.metas
  for all to authenticated using (public.is_gestor()) with check (public.is_gestor());

revoke all on public.profiles from anon;
revoke all on public.metas from anon;
revoke insert, update, delete on public.profiles from authenticated;
