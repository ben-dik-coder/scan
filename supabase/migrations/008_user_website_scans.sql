-- Lagrede nettside-/sosiale skann per bruker og orgnr (overlever innlogging)
create table if not exists public.user_website_scans (
  user_id uuid not null references auth.users (id) on delete cascade,
  orgnr text not null,
  scan jsonb not null,
  scanned_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, orgnr)
);

create index if not exists user_website_scans_user_scanned_idx
  on public.user_website_scans (user_id, scanned_at desc);

alter table public.user_website_scans enable row level security;

create policy "Users manage own website scans"
  on public.user_website_scans for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger user_website_scans_updated_at
  before update on public.user_website_scans
  for each row execute procedure public.set_updated_at();
