-- Unike firma med kontaktinfo (tlf/e-post) telt per bruker per måned
create table if not exists public.usage_company_leads (
  user_id uuid not null references auth.users (id) on delete cascade,
  month_key text not null,
  orgnr text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, month_key, orgnr)
);

create index if not exists usage_company_leads_user_month_idx
  on public.usage_company_leads (user_id, month_key);

alter table public.usage_company_leads enable row level security;

create policy "Users read own company usage"
  on public.usage_company_leads for select
  using (auth.uid() = user_id);
