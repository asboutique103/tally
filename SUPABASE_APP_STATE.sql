-- ConstructFlow browser app state persistence
-- Run this after SUPABASE_FULL_SCHEMA_V2.sql for existing projects.

create table if not exists public.app_state (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workspace_key text not null default 'default',
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, workspace_key)
);

alter table public.app_state enable row level security;

drop policy if exists app_state_owner_select on public.app_state;
drop policy if exists app_state_owner_insert on public.app_state;
drop policy if exists app_state_owner_update on public.app_state;
drop policy if exists app_state_owner_delete on public.app_state;

create policy app_state_owner_select
on public.app_state
for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy app_state_owner_insert
on public.app_state
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy app_state_owner_update
on public.app_state
for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy app_state_owner_delete
on public.app_state
for delete
to authenticated
using ((select auth.uid()) = owner_id);

grant select, insert, update, delete on public.app_state to authenticated;
