-- Kjør dette i Supabase: SQL Editor → New query → Run
-- Oppretter profiler (5-sifret ID) og lagring av økter for Scanix.
-- Kan kjøres flere ganger (policyer droppes før de opprettes på nytt).

-- Profiler (én rad per innlogget bruker)
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  short_id text not null unique,
  updated_at timestamptz not null default now(),
  constraint profiles_short_id_format check (short_id ~ '^[0-9]{5}$')
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- App-tilstand: økter + gjeldende økt-id (json)
create table if not exists public.user_app_state (
  user_id uuid primary key references auth.users on delete cascade,
  payload jsonb not null default '{"version":2,"sessions":[],"currentSessionId":null}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_app_state enable row level security;

drop policy if exists "user_app_state_select_own" on public.user_app_state;
drop policy if exists "user_app_state_insert_own" on public.user_app_state;
drop policy if exists "user_app_state_update_own" on public.user_app_state;

create policy "user_app_state_select_own"
  on public.user_app_state for select
  using (auth.uid() = user_id);

create policy "user_app_state_insert_own"
  on public.user_app_state for insert
  with check (auth.uid() = user_id);

create policy "user_app_state_update_own"
  on public.user_app_state for update
  using (auth.uid() = user_id);

-- Delte økter (mottaker ser i app; sending via RPC)
create table if not exists public.session_shares (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users (id) on delete cascade,
  to_user_id uuid not null references auth.users (id) on delete cascade,
  from_short_id text not null,
  from_display_name text,
  session_payload jsonb not null,
  created_at timestamptz not null default now(),
  constraint session_shares_not_self check (from_user_id <> to_user_id),
  constraint session_shares_from_short_format check (from_short_id ~ '^[0-9]{5}$')
);

create index if not exists session_shares_to_user_created_idx
  on public.session_shares (to_user_id, created_at desc);

alter table public.session_shares enable row level security;

drop policy if exists "session_shares_select_participants" on public.session_shares;
create policy "session_shares_select_participants"
  on public.session_shares for select
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

drop policy if exists "session_shares_delete_participants" on public.session_shares;
create policy "session_shares_delete_participants"
  on public.session_shares for delete
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

create or replace function public.send_session_share(
  p_recipient_short_id text,
  p_session_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from uuid := auth.uid();
  v_to uuid;
  v_short text;
  v_name text;
  v_id uuid;
  v_len int;
begin
  if v_from is null then
    raise exception 'Not authenticated';
  end if;
  if p_recipient_short_id is null or p_recipient_short_id !~ '^[0-9]{5}$' then
    raise exception 'Invalid recipient id';
  end if;
  v_len := octet_length(p_session_payload::text);
  if v_len is null or v_len > 4800000 then
    raise exception 'Payload too large';
  end if;
  select id into v_to from public.profiles
  where short_id = p_recipient_short_id limit 1;
  if v_to is null then
    raise exception 'Recipient not found';
  end if;
  if v_to = v_from then
    raise exception 'Cannot share to self';
  end if;
  select short_id, coalesce(display_name, '') into v_short, v_name
  from public.profiles where id = v_from limit 1;
  if v_short is null then
    raise exception 'Sender profile missing';
  end if;
  insert into public.session_shares (
    from_user_id, to_user_id, from_short_id, from_display_name, session_payload
  ) values (
    v_from, v_to, v_short, nullif(trim(v_name), ''), p_session_payload
  )
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.send_session_share(text, jsonb) to authenticated;

-- Liste for innboks: metadata + tellere uten å sende hele session_payload (store base64-bilder) til klienten.
create or replace function public.list_incoming_session_shares()
returns table (
  id uuid,
  from_short_id text,
  from_display_name text,
  created_at timestamptz,
  photo_count bigint,
  click_count bigint,
  share_kind text
)
language sql
security invoker
stable
set search_path = public
as $$
  select
    s.id,
    s.from_short_id,
    s.from_display_name,
    s.created_at,
    (
      case
        when jsonb_typeof(s.session_payload->'photos') = 'array'
          then jsonb_array_length(s.session_payload->'photos')
        else 0
      end
    )::bigint,
    (
      case
        when jsonb_typeof(s.session_payload->'clickHistory') = 'array'
          then jsonb_array_length(s.session_payload->'clickHistory')
        else 0
      end
    )::bigint,
    nullif(trim(s.session_payload->>'shareKind'), '')
  from public.session_shares s
  where s.to_user_id = auth.uid()
  order by s.created_at desc
  limit 40;
$$;

grant execute on function public.list_incoming_session_shares() to authenticated;

-- Realtime (valgfritt): Database → Replication → slå på for session_shares, eller kjør:
-- alter publication supabase_realtime add table public.session_shares;
