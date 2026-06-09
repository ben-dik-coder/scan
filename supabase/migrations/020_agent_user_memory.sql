-- Langtidsminne for AI-agent (bruker-preferanser)

create table public.agent_user_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  memory_key text not null,
  memory_value text not null default '',
  updated_at timestamptz not null default now(),
  unique (user_id, memory_key)
);

create index agent_user_memory_user_idx
  on public.agent_user_memory (user_id, updated_at desc);

alter table public.agent_user_memory enable row level security;

create policy "Users manage own agent memory"
  on public.agent_user_memory for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
