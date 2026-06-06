-- ═══════════════════════════════════════════════════════════════
-- KJØR HELE DENNE FILEN I SUPABASE → SQL Editor → Run
-- Prosjekt: https://supabase.com/dashboard/project/umsimryvoifrjmkaelup/sql/new
-- ═══════════════════════════════════════════════════════════════

-- 004: Abonnement (NyLead + eldre planer)
alter table public.profiles
  add column if not exists plan text check (plan in ('nylead', 'start', 'pro', 'agency')),
  add column if not exists subscription_status text check (
    subscription_status in (
      'active',
      'trialing',
      'past_due',
      'canceled',
      'incomplete',
      'unpaid'
    )
  ),
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_current_period_end timestamptz;

create unique index if not exists profiles_stripe_customer_id_idx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists profiles_stripe_subscription_id_idx
  on public.profiles (stripe_subscription_id)
  where stripe_subscription_id is not null;

create or replace function public.protect_billing_columns()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    new.plan := old.plan;
    new.subscription_status := old.subscription_status;
    new.stripe_customer_id := old.stripe_customer_id;
    new.stripe_subscription_id := old.stripe_subscription_id;
    new.subscription_current_period_end := old.subscription_current_period_end;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_billing_columns on public.profiles;
create trigger protect_billing_columns
  before update on public.profiles
  for each row
  execute function public.protect_billing_columns();

-- 005: Månedlig telling (nettside-søk)
create table if not exists public.usage_monthly (
  user_id uuid not null references auth.users (id) on delete cascade,
  month_key text not null,
  website_searches int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, month_key)
);

alter table public.usage_monthly enable row level security;

drop policy if exists "Users read own usage" on public.usage_monthly;
create policy "Users read own usage"
  on public.usage_monthly for select
  using (auth.uid() = user_id);

-- 006: Månedlig telling (bedrifter med tlf/e-post)
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

drop policy if exists "Users read own company usage" on public.usage_company_leads;
create policy "Users read own company usage"
  on public.usage_company_leads for select
  using (auth.uid() = user_id);

-- 007: SMTP / app-passord for Outlook/Hotmail
alter table public.user_mail_accounts
  drop constraint if exists user_mail_accounts_provider_check;

alter table public.user_mail_accounts
  add constraint user_mail_accounts_provider_check
  check (provider in ('google', 'microsoft', 'smtp'));

-- 008: Lagrede nettside-/sosiale skann per bruker
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

drop policy if exists "Users manage own website scans" on public.user_website_scans;
create policy "Users manage own website scans"
  on public.user_website_scans for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists user_website_scans_updated_at on public.user_website_scans;
create trigger user_website_scans_updated_at
  before update on public.user_website_scans
  for each row execute procedure public.set_updated_at();

-- 010: Global Google-sjekk per orgnr (delt mellom brukere)
create table if not exists public.company_website_scans (
  orgnr text primary key,
  scan jsonb not null,
  scanned_at timestamptz not null,
  scanned_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_website_scans_scanned_at_idx
  on public.company_website_scans (scanned_at desc);

alter table public.company_website_scans enable row level security;

drop policy if exists "Authenticated read company website scans" on public.company_website_scans;
create policy "Authenticated read company website scans"
  on public.company_website_scans for select
  to authenticated
  using (true);

drop policy if exists "Authenticated insert company website scans" on public.company_website_scans;
create policy "Authenticated insert company website scans"
  on public.company_website_scans for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated update company website scans" on public.company_website_scans;
create policy "Authenticated update company website scans"
  on public.company_website_scans for update
  to authenticated
  using (true)
  with check (true);

insert into public.company_website_scans (orgnr, scan, scanned_at, scanned_by)
select distinct on (orgnr) orgnr, scan, scanned_at, user_id
from public.user_website_scans
order by orgnr, scanned_at desc
on conflict (orgnr) do update
set
  scan = excluded.scan,
  scanned_at = excluded.scanned_at,
  scanned_by = excluded.scanned_by,
  updated_at = now()
where excluded.scanned_at > company_website_scans.scanned_at;

drop trigger if exists company_website_scans_updated_at on public.company_website_scans;
create trigger company_website_scans_updated_at
  before update on public.company_website_scans
  for each row execute procedure public.set_updated_at();

-- 012: Ukentlig varsel, webhook, A/B-kampanje, daglig leder
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  webhook_url text,
  weekly_alert_enabled boolean not null default false,
  weekly_alert_filters jsonb not null default '{}'::jsonb,
  weekly_alert_last_sent_at timestamptz,
  trial_nudges_sent jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists "Users manage own settings" on public.user_settings;
create policy "Users manage own settings"
  on public.user_settings for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists user_settings_updated_at on public.user_settings;
create trigger user_settings_updated_at
  before update on public.user_settings
  for each row execute procedure public.set_updated_at();

alter table public.email_campaigns
  add column if not exists subject_b text;

alter table public.email_campaign_recipients
  add column if not exists ab_variant text
  check (ab_variant is null or ab_variant in ('a', 'b'));

alter table public.companies
  add column if not exists daglig_leder text;

-- 015: Flere e-postkontoer per bruker (f.eks. to Outlook via OAuth)
alter table public.user_mail_accounts
  drop constraint if exists user_mail_accounts_user_id_provider_key;

alter table public.user_mail_accounts
  drop constraint if exists user_mail_accounts_user_id_email_key;

alter table public.user_mail_accounts
  add constraint user_mail_accounts_user_id_email_key unique (user_id, email);
