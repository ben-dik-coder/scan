-- Roadmap: ukentlig varsel, webhook, A/B-kampanje, daglig leder

-- Brukerinnstillinger (webhook + ukentlig varsel)
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  webhook_url text,
  weekly_alert_enabled boolean not null default false,
  weekly_alert_filters jsonb not null default '{}'::jsonb,
  weekly_alert_last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_settings_updated_at
  before update on public.user_settings
  for each row execute procedure public.set_updated_at();

alter table public.user_settings enable row level security;

create policy "Users manage own settings"
  on public.user_settings for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- A/B på kampanje
alter table public.email_campaigns
  add column if not exists subject_b text;

alter table public.email_campaign_recipients
  add column if not exists ab_variant text
  check (ab_variant is null or ab_variant in ('a', 'b'));

-- Daglig leder fra Brreg (fylles ved behov)
alter table public.companies
  add column if not exists daglig_leder text;
