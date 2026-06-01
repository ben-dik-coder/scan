-- Profiles (extends auth.users)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'admin')),
  company_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Companies from Brreg
create table public.companies (
  orgnr text primary key,
  name text not null,
  email text,
  phone text,
  mobile text,
  municipality_code text,
  municipality_name text,
  industry_code text,
  registered_at date,
  has_email boolean not null default false,
  email_is_generic boolean not null default false,
  brreg_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index companies_municipality_registered_idx
  on public.companies (municipality_code, registered_at desc);

create index companies_has_email_idx on public.companies (has_email) where has_email = true;

create index companies_registered_at_idx on public.companies (registered_at desc);

-- Sync state
create table public.sync_state (
  key text primary key,
  last_sync timestamptz,
  cursor text,
  metadata jsonb default '{}'::jsonb
);

-- Email unsubscribes
create table public.email_unsubscribes (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  orgnr text,
  reason text,
  created_at timestamptz not null default now()
);

create index email_unsubscribes_email_idx on public.email_unsubscribes (lower(email));

-- Email campaigns
create table public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject text not null,
  body text not null,
  sent_count int not null default 0,
  failed_count int not null default 0,
  created_at timestamptz not null default now()
);

create table public.email_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.email_campaigns (id) on delete cascade,
  orgnr text not null references public.companies (orgnr) on delete cascade,
  email text not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'unsubscribed', 'blocked')),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index email_campaign_recipients_campaign_idx
  on public.email_campaign_recipients (campaign_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, company_name)
  values (
    new.id,
    'user',
    coalesce(new.raw_user_meta_data->>'company_name', null)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger companies_updated_at
  before update on public.companies
  for each row execute procedure public.set_updated_at();

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- RLS
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.sync_state enable row level security;
alter table public.email_unsubscribes enable row level security;
alter table public.email_campaigns enable row level security;
alter table public.email_campaign_recipients enable row level security;

-- Profiles: users read/update own
create policy "Users read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Companies: authenticated users can read
create policy "Authenticated read companies"
  on public.companies for select
  to authenticated
  using (true);

-- Sync state: admins only (via profile check)
create policy "Admins read sync_state"
  on public.sync_state for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Unsubscribes: public insert for avmeld page (anon), read for authenticated
create policy "Anyone can unsubscribe"
  on public.email_unsubscribes for insert
  to anon, authenticated
  with check (true);

create policy "Authenticated read unsubscribes"
  on public.email_unsubscribes for select
  to authenticated
  using (true);

-- Campaigns: own campaigns only
create policy "Users read own campaigns"
  on public.email_campaigns for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users insert own campaigns"
  on public.email_campaigns for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own campaigns"
  on public.email_campaigns for update
  to authenticated
  using (auth.uid() = user_id);

-- Recipients: via campaign ownership
create policy "Users read own campaign recipients"
  on public.email_campaign_recipients for select
  to authenticated
  using (
    exists (
      select 1 from public.email_campaigns c
      where c.id = campaign_id and c.user_id = auth.uid()
    )
  );

create policy "Users insert own campaign recipients"
  on public.email_campaign_recipients for insert
  to authenticated
  with check (
    exists (
      select 1 from public.email_campaigns c
      where c.id = campaign_id and c.user_id = auth.uid()
    )
  );

create policy "Users update own campaign recipients"
  on public.email_campaign_recipients for update
  to authenticated
  using (
    exists (
      select 1 from public.email_campaigns c
      where c.id = campaign_id and c.user_id = auth.uid()
    )
  );
