-- Poststed og hjemmeside fra Brreg — brukes i Google/FB/IG-søk
alter table public.companies
  add column if not exists city text,
  add column if not exists website text;

create index if not exists companies_city_idx
  on public.companies (city)
  where city is not null;

create index if not exists companies_website_idx
  on public.companies (website)
  where website is not null;
