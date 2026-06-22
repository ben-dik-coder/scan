-- Salgsmanus per bruker (telefon/e-post)
create table if not exists public.user_manus (
  user_id uuid primary key references auth.users (id) on delete cascade,
  title text not null default 'Manus',
  body_html text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_manus_updated_at
  before update on public.user_manus
  for each row execute procedure public.set_updated_at();

alter table public.user_manus enable row level security;

drop policy if exists "Users manage own manus" on public.user_manus;
create policy "Users manage own manus"
  on public.user_manus for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
