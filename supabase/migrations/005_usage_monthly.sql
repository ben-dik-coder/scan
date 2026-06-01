-- Månedlig telling av nettside-søk (Google-skanning) per bruker
create table if not exists public.usage_monthly (
  user_id uuid not null references auth.users (id) on delete cascade,
  month_key text not null,
  website_searches int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, month_key)
);

alter table public.usage_monthly enable row level security;

create policy "Users read own usage"
  on public.usage_monthly for select
  using (auth.uid() = user_id);
