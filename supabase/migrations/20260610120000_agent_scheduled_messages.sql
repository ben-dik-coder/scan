-- Planlagte AI-agent-meldinger: bruker velger tidspunkt, agent kjører senere

create table public.agent_scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  message text not null,
  scheduled_at timestamptz not null,
  conversation_id uuid references public.agent_conversations (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'failed', 'cancelled')),
  result jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index agent_scheduled_messages_due_idx
  on public.agent_scheduled_messages (scheduled_at asc)
  where status = 'pending';

create index agent_scheduled_messages_user_idx
  on public.agent_scheduled_messages (user_id, scheduled_at desc);

create trigger agent_scheduled_messages_updated_at
  before update on public.agent_scheduled_messages
  for each row execute procedure public.set_updated_at();

alter table public.agent_scheduled_messages enable row level security;

create policy "Users manage own scheduled agent messages"
  on public.agent_scheduled_messages for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
