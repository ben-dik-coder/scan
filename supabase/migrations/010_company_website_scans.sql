-- Global Google-/Facebook-/Instagram-sjekk per orgnr (delt på tvers av brukere).
-- Målet er å unngå gjentatte SerpAPI-kall for samme firma.
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

create policy "Authenticated read company website scans"
  on public.company_website_scans for select
  to authenticated
  using (true);

create policy "Authenticated insert company website scans"
  on public.company_website_scans for insert
  to authenticated
  with check (true);

create policy "Authenticated update company website scans"
  on public.company_website_scans for update
  to authenticated
  using (true)
  with check (true);

-- Flytt eksisterende per-bruker-skann (nyeste vinner per orgnr)
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

create trigger company_website_scans_updated_at
  before update on public.company_website_scans
  for each row execute procedure public.set_updated_at();
