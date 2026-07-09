-- ConstructFlow app login and protected workspace persistence.
-- Safe to run more than once in Supabase SQL Editor.

create extension if not exists pgcrypto;

do $$
begin
  create type public.app_role as enum ('owner', 'admin', 'accountant', 'storekeeper', 'site_engineer', 'viewer');
exception when duplicate_object then null;
end $$;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  password_hash text not null,
  role public.app_role not null default 'viewer',
  is_active boolean not null default true,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_users add column if not exists id uuid default gen_random_uuid();
update public.app_users set id = gen_random_uuid() where id is null;
alter table public.app_users alter column id set not null;
alter table public.app_users add column if not exists username text;
alter table public.app_users add column if not exists password_hash text;
alter table public.app_users add column if not exists role public.app_role not null default 'viewer';
alter table public.app_users add column if not exists is_active boolean not null default true;
alter table public.app_users add column if not exists failed_attempts integer not null default 0;
alter table public.app_users add column if not exists locked_until timestamptz;
alter table public.app_users add column if not exists created_at timestamptz not null default now();
alter table public.app_users add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.app_users'::regclass and contype = 'p'
  ) then
    alter table public.app_users add constraint app_users_pkey primary key (id);
  end if;
end $$;

create unique index if not exists app_users_username_lower_key on public.app_users (lower(username));

do $$
begin
  if exists (select 1 from public.app_users where lower(username) = 'admin') then
    update public.app_users
    set username = 'Admin',
        password_hash = crypt('Admin@766', gen_salt('bf')),
        role = 'owner',
        is_active = true,
        failed_attempts = 0,
        locked_until = null,
        updated_at = now()
    where lower(username) = 'admin';
  else
    insert into public.app_users (username, password_hash, role, is_active)
    values ('Admin', crypt('Admin@766', gen_salt('bf')), 'owner', true);
  end if;
end $$;

create table if not exists public.app_sessions (
  id uuid primary key default gen_random_uuid(),
  app_user_id uuid not null references public.app_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists app_sessions_user_idx on public.app_sessions (app_user_id);
create index if not exists app_sessions_expires_idx on public.app_sessions (expires_at);

create table if not exists public.app_state (
  id uuid primary key default gen_random_uuid(),
  workspace_key text not null default 'default',
  data jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  updated_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_state add column if not exists workspace_key text not null default 'default';
alter table public.app_state add column if not exists data jsonb not null default '{}'::jsonb;
alter table public.app_state add column if not exists version integer not null default 1;
alter table public.app_state add column if not exists updated_by uuid references public.app_users(id);
alter table public.app_state add column if not exists created_at timestamptz not null default now();
alter table public.app_state add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'app_state' and column_name = 'owner_id'
  ) then
    alter table public.app_state alter column owner_id drop not null;
  end if;
end $$;

delete from public.app_state a
using (
  select id, row_number() over (partition by workspace_key order by updated_at desc nulls last, id desc) as row_no
  from public.app_state
) ranked
where a.id = ranked.id and ranked.row_no > 1;

create unique index if not exists app_state_workspace_key_key on public.app_state (workspace_key);

alter table public.app_users enable row level security;
alter table public.app_sessions enable row level security;
alter table public.app_state enable row level security;

drop policy if exists app_state_owner_select on public.app_state;
drop policy if exists app_state_owner_insert on public.app_state;
drop policy if exists app_state_owner_update on public.app_state;
drop policy if exists app_state_owner_delete on public.app_state;

revoke all on table public.app_users from anon, authenticated;
revoke all on table public.app_sessions from anon, authenticated;
revoke all on table public.app_state from anon, authenticated;

create or replace function public.login_app_user(p_username text, p_password text)
returns table (
  ok boolean,
  username text,
  role text,
  session_token text,
  expires_at timestamptz,
  message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.app_users%rowtype;
  v_token text;
  v_token_hash text;
  v_expires_at timestamptz := now() + interval '12 hours';
begin
  delete from public.app_sessions where expires_at <= now();

  select * into v_user
  from public.app_users
  where lower(username) = lower(trim(coalesce(p_username, '')))
  limit 1;

  if v_user.id is null or not v_user.is_active then
    return query select false, null::text, null::text, null::text, null::timestamptz, 'Invalid username or password.'::text;
    return;
  end if;

  if v_user.locked_until is not null and v_user.locked_until > now() then
    return query select false, null::text, null::text, null::text, null::timestamptz, 'Too many failed attempts. Try again later.'::text;
    return;
  end if;

  if v_user.password_hash is null or v_user.password_hash <> crypt(coalesce(p_password, ''), v_user.password_hash) then
    update public.app_users
    set failed_attempts = failed_attempts + 1,
        locked_until = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' else null end,
        updated_at = now()
    where id = v_user.id;
    return query select false, null::text, null::text, null::text, null::timestamptz, 'Invalid username or password.'::text;
    return;
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');

  insert into public.app_sessions (app_user_id, token_hash, expires_at)
  values (v_user.id, v_token_hash, v_expires_at);

  update public.app_users
  set failed_attempts = 0,
      locked_until = null,
      updated_at = now()
  where id = v_user.id;

  return query select true, v_user.username, v_user.role::text, v_token, v_expires_at, null::text;
end;
$$;

create or replace function public.get_app_session(p_session_token text)
returns table (
  ok boolean,
  username text,
  role text,
  expires_at timestamptz,
  message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text := encode(digest(coalesce(p_session_token, ''), 'sha256'), 'hex');
  v_username text;
  v_role text;
  v_expires_at timestamptz;
begin
  select u.username, u.role::text, s.expires_at
  into v_username, v_role, v_expires_at
  from public.app_sessions s
  join public.app_users u on u.id = s.app_user_id
  where s.token_hash = v_hash
    and s.expires_at > now()
    and u.is_active
  limit 1;

  if v_username is null then
    return query select false, null::text, null::text, null::timestamptz, 'Session expired. Sign in again.'::text;
    return;
  end if;

  update public.app_sessions set last_seen_at = now() where token_hash = v_hash;
  return query select true, v_username, v_role, v_expires_at, null::text;
end;
$$;

create or replace function public.get_app_state(p_session_token text, p_workspace_key text default 'default')
returns table (
  ok boolean,
  data jsonb,
  version integer,
  username text,
  role text,
  message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text := encode(digest(coalesce(p_session_token, ''), 'sha256'), 'hex');
  v_user_id uuid;
  v_username text;
  v_role text;
  v_data jsonb;
  v_version integer;
begin
  select u.id, u.username, u.role::text
  into v_user_id, v_username, v_role
  from public.app_sessions s
  join public.app_users u on u.id = s.app_user_id
  where s.token_hash = v_hash
    and s.expires_at > now()
    and u.is_active
  limit 1;

  if v_user_id is null then
    return query select false, null::jsonb, null::integer, null::text, null::text, 'Session expired. Sign in again.'::text;
    return;
  end if;

  update public.app_sessions set last_seen_at = now() where token_hash = v_hash;

  select app_state.data, app_state.version
  into v_data, v_version
  from public.app_state
  where workspace_key = coalesce(nullif(trim(p_workspace_key), ''), 'default')
  limit 1;

  return query select true, v_data, v_version, v_username, v_role, null::text;
end;
$$;

create or replace function public.save_app_state(
  p_session_token text,
  p_workspace_key text default 'default',
  p_data jsonb default '{}'::jsonb,
  p_expected_version integer default null
)
returns table (
  ok boolean,
  version integer,
  message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text := encode(digest(coalesce(p_session_token, ''), 'sha256'), 'hex');
  v_user_id uuid;
  v_role text;
  v_workspace_key text := coalesce(nullif(trim(p_workspace_key), ''), 'default');
  v_version integer;
begin
  select u.id, u.role::text
  into v_user_id, v_role
  from public.app_sessions s
  join public.app_users u on u.id = s.app_user_id
  where s.token_hash = v_hash
    and s.expires_at > now()
    and u.is_active
  limit 1;

  if v_user_id is null then
    return query select false, null::integer, 'Session expired. Sign in again.'::text;
    return;
  end if;

  if v_role = 'viewer' then
    return query select false, null::integer, 'Viewer role cannot save workspace changes.'::text;
    return;
  end if;

  update public.app_sessions set last_seen_at = now() where token_hash = v_hash;

  if p_expected_version is null then
    insert into public.app_state (workspace_key, data, version, updated_by, updated_at)
    values (v_workspace_key, coalesce(p_data, '{}'::jsonb), 1, v_user_id, now())
    on conflict (workspace_key) do nothing
    returning app_state.version into v_version;

    if v_version is null then
      select app_state.version into v_version
      from public.app_state
      where workspace_key = v_workspace_key;
      return query select false, v_version, 'Cloud workspace already exists. Reload before saving.'::text;
      return;
    end if;

    return query select true, v_version, null::text;
    return;
  end if;

  update public.app_state
  set data = coalesce(p_data, '{}'::jsonb),
      version = app_state.version + 1,
      updated_by = v_user_id,
      updated_at = now()
  where workspace_key = v_workspace_key
    and version = p_expected_version
  returning app_state.version into v_version;

  if v_version is null then
    select app_state.version into v_version
    from public.app_state
    where workspace_key = v_workspace_key;
    return query select false, v_version, 'Cloud workspace changed in another tab or device. Reloaded latest data.'::text;
    return;
  end if;

  return query select true, v_version, null::text;
end;
$$;

create or replace function public.logout_app_user(p_session_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.app_sessions
  where token_hash = encode(digest(coalesce(p_session_token, ''), 'sha256'), 'hex');
end;
$$;

revoke all on function public.login_app_user(text, text) from public;
revoke all on function public.get_app_session(text) from public;
revoke all on function public.get_app_state(text, text) from public;
revoke all on function public.save_app_state(text, text, jsonb, integer) from public;
revoke all on function public.logout_app_user(text) from public;

grant execute on function public.login_app_user(text, text) to anon, authenticated;
grant execute on function public.get_app_session(text) to anon, authenticated;
grant execute on function public.get_app_state(text, text) to anon, authenticated;
grant execute on function public.save_app_state(text, text, jsonb, integer) to anon, authenticated;
grant execute on function public.logout_app_user(text) to anon, authenticated;
