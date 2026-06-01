-- Koblet Gmail / Outlook per bruker
create table public.user_mail_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  email text not null,
  access_token_enc text not null,
  refresh_token_enc text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index user_mail_accounts_user_idx on public.user_mail_accounts (user_id);

alter table public.user_mail_accounts enable row level security;

create policy "Users read own mail accounts"
  on public.user_mail_accounts for select
  using (auth.uid() = user_id);

create policy "Users delete own mail accounts"
  on public.user_mail_accounts for delete
  using (auth.uid() = user_id);

-- Inserts/updates kun via service role (API etter OAuth)
