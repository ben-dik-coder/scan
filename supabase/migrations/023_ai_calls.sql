-- AI outbound-samtaler (Vapi)
create table if not exists public.ai_calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  orgnr text not null,
  phone text not null,
  vapi_call_id text,
  status text not null default 'queued'
    check (status in ('queued', 'ringing', 'in_progress', 'ended', 'failed')),
  outcome text
    check (
      outcome is null
      or outcome in ('meeting', 'not_interested', 'no_answer', 'voicemail', 'other')
    ),
  transcript text,
  summary text,
  started_at timestamptz,
  ended_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_calls_user_id_idx
  on public.ai_calls (user_id, created_at desc);

create index if not exists ai_calls_vapi_call_id_idx
  on public.ai_calls (vapi_call_id)
  where vapi_call_id is not null;

create index if not exists ai_calls_orgnr_idx
  on public.ai_calls (user_id, orgnr, created_at desc);

create index if not exists ai_calls_active_idx
  on public.ai_calls (user_id, status)
  where status in ('queued', 'ringing', 'in_progress');

drop trigger if exists ai_calls_updated_at on public.ai_calls;
create trigger ai_calls_updated_at
  before update on public.ai_calls
  for each row execute procedure public.set_updated_at();

alter table public.ai_calls enable row level security;

drop policy if exists "Users read own ai_calls" on public.ai_calls;
create policy "Users read own ai_calls"
  on public.ai_calls for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users insert own ai_calls" on public.ai_calls;
create policy "Users insert own ai_calls"
  on public.ai_calls for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update own ai_calls" on public.ai_calls;
create policy "Users update own ai_calls"
  on public.ai_calls for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
