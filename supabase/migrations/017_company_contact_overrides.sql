-- Manuelt researchede kontaktfelt (brukes når Brreg mangler telefon/eier).
create table if not exists public.company_contact_overrides (
  orgnr text primary key references public.companies (orgnr) on delete cascade,
  mobile text,
  phone text,
  owner_name text,
  source text,
  notes text,
  updated_at timestamptz not null default now()
);

create index if not exists company_contact_overrides_updated_idx
  on public.company_contact_overrides (updated_at desc);

alter table public.company_contact_overrides enable row level security;

create policy "Authenticated read contact overrides"
  on public.company_contact_overrides for select
  to authenticated
  using (true);

create policy "Authenticated upsert contact overrides"
  on public.company_contact_overrides for insert
  to authenticated
  with check (true);

create policy "Authenticated update contact overrides"
  on public.company_contact_overrides for update
  to authenticated
  using (true);
