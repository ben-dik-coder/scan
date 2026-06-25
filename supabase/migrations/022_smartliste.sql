-- Smartliste: strukturerte lagrede lister med soner, items og merkelapper

alter table public.saved_lists
  add column if not exists list_kind text not null default 'static'
    check (list_kind in ('static', 'dynamic')),
  add column if not exists board_config jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists saved_lists_user_updated_idx
  on public.saved_lists (user_id, updated_at desc);

drop trigger if exists saved_lists_updated_at on public.saved_lists;
create trigger saved_lists_updated_at
  before update on public.saved_lists
  for each row execute procedure public.set_updated_at();

create table if not exists public.smart_list_lanes (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.saved_lists (id) on delete cascade,
  name text not null,
  color text not null default 'slate',
  sort_order int not null default 0,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists smart_list_lanes_list_idx
  on public.smart_list_lanes (list_id, sort_order);

create table if not exists public.smart_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.saved_lists (id) on delete cascade,
  orgnr text not null,
  lane_id uuid references public.smart_list_lanes (id) on delete set null,
  sort_order int not null default 0,
  pinned boolean not null default false,
  ai_score int,
  ai_score_reason text,
  note text,
  snooze_until timestamptz,
  custom_fields jsonb not null default '{}'::jsonb,
  added_at timestamptz not null default now(),
  last_ai_rank_at timestamptz,
  unique (list_id, orgnr)
);

create index if not exists smart_list_items_list_lane_idx
  on public.smart_list_items (list_id, lane_id, sort_order);
create index if not exists smart_list_items_list_orgnr_idx
  on public.smart_list_items (list_id, orgnr);

create table if not exists public.smart_list_labels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text not null default 'sky',
  icon text,
  group_name text,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists smart_list_labels_user_idx
  on public.smart_list_labels (user_id);

create table if not exists public.smart_list_item_labels (
  item_id uuid not null references public.smart_list_items (id) on delete cascade,
  label_id uuid not null references public.smart_list_labels (id) on delete cascade,
  primary key (item_id, label_id)
);

alter table public.smart_list_lanes enable row level security;
alter table public.smart_list_items enable row level security;
alter table public.smart_list_labels enable row level security;
alter table public.smart_list_item_labels enable row level security;

drop policy if exists "Users manage own smart list lanes" on public.smart_list_lanes;
create policy "Users manage own smart list lanes"
  on public.smart_list_lanes for all
  to authenticated
  using (
    exists (
      select 1 from public.saved_lists s
      where s.id = list_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.saved_lists s
      where s.id = list_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "Users manage own smart list items" on public.smart_list_items;
create policy "Users manage own smart list items"
  on public.smart_list_items for all
  to authenticated
  using (
    exists (
      select 1 from public.saved_lists s
      where s.id = list_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.saved_lists s
      where s.id = list_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "Users manage own smart list labels" on public.smart_list_labels;
create policy "Users manage own smart list labels"
  on public.smart_list_labels for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own smart list item labels" on public.smart_list_item_labels;
create policy "Users manage own smart list item labels"
  on public.smart_list_item_labels for all
  to authenticated
  using (
    exists (
      select 1
      from public.smart_list_items i
      join public.saved_lists s on s.id = i.list_id
      where i.id = item_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.smart_list_items i
      join public.saved_lists s on s.id = i.list_id
      where i.id = item_id and s.user_id = auth.uid()
    )
  );
