-- AI-agent for kunder: samtaler, meldinger og kjøringer

create table public.agent_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Ny samtale',
  status text not null default 'active'
    check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index agent_conversations_user_idx
  on public.agent_conversations (user_id, updated_at desc);

create table public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.agent_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'tool')),
  content text not null default '',
  tool_calls jsonb,
  tool_name text,
  created_at timestamptz not null default now()
);

create index agent_messages_conversation_idx
  on public.agent_messages (conversation_id, created_at asc);

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.agent_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'running'
    check (status in ('running', 'done', 'failed')),
  params jsonb not null default '{}'::jsonb,
  progress jsonb not null default '{}'::jsonb,
  result jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index agent_runs_user_status_idx
  on public.agent_runs (user_id, status)
  where status = 'running';

create trigger agent_conversations_updated_at
  before update on public.agent_conversations
  for each row execute procedure public.set_updated_at();

create trigger agent_runs_updated_at
  before update on public.agent_runs
  for each row execute procedure public.set_updated_at();

alter table public.agent_conversations enable row level security;
alter table public.agent_messages enable row level security;
alter table public.agent_runs enable row level security;

create policy "Users manage own agent conversations"
  on public.agent_conversations for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own agent messages"
  on public.agent_messages for all
  to authenticated
  using (
    exists (
      select 1 from public.agent_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.agent_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

create policy "Users manage own agent runs"
  on public.agent_runs for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
