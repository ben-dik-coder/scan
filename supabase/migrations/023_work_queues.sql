-- Navngitte arbeidskøer med manuell rekkefølge (additive, bakoverkompatibel)

create table if not exists public.work_queues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  source_list_id uuid references public.saved_lists (id) on delete set null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists work_queues_user_idx
  on public.work_queues (user_id, updated_at desc);

create unique index if not exists work_queues_one_default_per_user
  on public.work_queues (user_id)
  where is_default = true;

create table if not exists public.work_queue_items (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references public.work_queues (id) on delete cascade,
  orgnr text not null,
  sort_order int not null default 0,
  pinned boolean not null default false,
  snooze_until timestamptz,
  created_at timestamptz not null default now(),
  unique (queue_id, orgnr)
);

create index if not exists work_queue_items_queue_sort_idx
  on public.work_queue_items (queue_id, pinned desc, sort_order asc);

drop trigger if exists work_queues_updated_at on public.work_queues;
create trigger work_queues_updated_at
  before update on public.work_queues
  for each row execute procedure public.set_updated_at();

alter table public.work_queues enable row level security;
alter table public.work_queue_items enable row level security;

drop policy if exists "Users manage own work queues" on public.work_queues;
create policy "Users manage own work queues"
  on public.work_queues for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own work queue items" on public.work_queue_items;
create policy "Users manage own work queue items"
  on public.work_queue_items for all
  to authenticated
  using (
    exists (
      select 1 from public.work_queues q
      where q.id = work_queue_items.queue_id and q.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.work_queues q
      where q.id = work_queue_items.queue_id and q.user_id = auth.uid()
    )
  );
