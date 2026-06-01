-- Salgsverktøy: pipeline, maler, sekvenser, aktiviteter, lagrede lister

-- Per-bruker CRM-tilstand for hvert firma
create table public.user_leads (
  user_id uuid not null references auth.users (id) on delete cascade,
  orgnr text not null references public.companies (orgnr) on delete cascade,
  status text not null default 'ny'
    check (status in ('ny', 'kontaktet', 'svarte', 'moete_booket', 'vunnet', 'tapt', 'ikke_interessert')),
  score int not null default 0 check (score >= 0 and score <= 100),
  notes text,
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, orgnr)
);

create index user_leads_user_status_idx on public.user_leads (user_id, status);
create index user_leads_user_score_idx on public.user_leads (user_id, score desc);
create index user_leads_follow_up_idx on public.user_leads (user_id, next_follow_up_at)
  where next_follow_up_at is not null;

-- Lagrede e-postmaler
create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  subject text not null,
  body text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index email_templates_user_idx on public.email_templates (user_id);

-- E-postsekvenser (flerstegs oppfølging)
create table public.email_sequences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.email_sequence_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.email_sequences (id) on delete cascade,
  step_order int not null check (step_order >= 0),
  delay_days int not null default 0 check (delay_days >= 0),
  subject text not null,
  body text not null,
  created_at timestamptz not null default now(),
  unique (sequence_id, step_order)
);

-- Påmelding til sekvens per firma
create table public.sequence_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  sequence_id uuid not null references public.email_sequences (id) on delete cascade,
  orgnr text not null references public.companies (orgnr) on delete cascade,
  current_step int not null default 0,
  status text not null default 'active'
    check (status in ('active', 'completed', 'paused', 'replied', 'unsubscribed', 'failed')),
  enrolled_at timestamptz not null default now(),
  next_send_at timestamptz,
  last_sent_at timestamptz,
  unique (user_id, sequence_id, orgnr)
);

create index sequence_enrollments_due_idx
  on public.sequence_enrollments (next_send_at)
  where status = 'active' and next_send_at is not null;

-- Aktivitetslogg per lead
create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  orgnr text not null references public.companies (orgnr) on delete cascade,
  activity_type text not null
    check (activity_type in (
      'email_sent', 'status_changed', 'note_added', 'call',
      'sequence_enrolled', 'sequence_sent', 'sequence_paused', 'follow_up_set'
    )),
  description text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index lead_activities_user_orgnr_idx
  on public.lead_activities (user_id, orgnr, created_at desc);

-- Lagrede lister / ICP-filter
create table public.saved_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index saved_lists_user_idx on public.saved_lists (user_id);

-- Triggers for updated_at
create trigger user_leads_updated_at
  before update on public.user_leads
  for each row execute procedure public.set_updated_at();

create trigger email_templates_updated_at
  before update on public.email_templates
  for each row execute procedure public.set_updated_at();

create trigger email_sequences_updated_at
  before update on public.email_sequences
  for each row execute procedure public.set_updated_at();

-- RLS
alter table public.user_leads enable row level security;
alter table public.email_templates enable row level security;
alter table public.email_sequences enable row level security;
alter table public.email_sequence_steps enable row level security;
alter table public.sequence_enrollments enable row level security;
alter table public.lead_activities enable row level security;
alter table public.saved_lists enable row level security;

-- user_leads
create policy "Users manage own leads"
  on public.user_leads for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- email_templates
create policy "Users manage own templates"
  on public.email_templates for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- email_sequences
create policy "Users manage own sequences"
  on public.email_sequences for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- sequence steps via sequence ownership
create policy "Users manage own sequence steps"
  on public.email_sequence_steps for all
  to authenticated
  using (
    exists (
      select 1 from public.email_sequences s
      where s.id = sequence_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.email_sequences s
      where s.id = sequence_id and s.user_id = auth.uid()
    )
  );

-- sequence enrollments
create policy "Users manage own enrollments"
  on public.sequence_enrollments for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- lead activities
create policy "Users manage own activities"
  on public.lead_activities for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- saved lists
create policy "Users manage own saved lists"
  on public.saved_lists for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Seed default templates function (called from app on first login optional)
-- Users get templates via UI
