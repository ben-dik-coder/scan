-- Stabil lane_key på Smartliste-soner (additive)

alter table public.smart_list_lanes
  add column if not exists lane_key text;

create index if not exists smart_list_lanes_list_key_idx
  on public.smart_list_lanes (list_id, lane_key)
  where lane_key is not null;

-- Backfill systemsoner der lane_key mangler
update public.smart_list_lanes l
set lane_key = v.key
from (
  values
    ('A — Topp prioritet', 'a'),
    ('B — Vurder', 'b'),
    ('C — Lav prioritet', 'c'),
    ('Arkiv / Parkert', 'archive'),
    ('Nytt / Uklassifisert', 'new')
) as v(name, key)
where l.lane_key is null and l.name = v.name;
