-- Eksplisitt arbeidskø: bare leads med queued_at vises i /app/ko
alter table public.user_leads
  add column if not exists queued_at timestamptz;

create index if not exists user_leads_queued_idx
  on public.user_leads (user_id, queued_at desc)
  where queued_at is not null;
