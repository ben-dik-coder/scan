-- Serper API-kall per bruker per måned (maks 1500)
alter table public.usage_monthly
  add column if not exists serper_api_calls int not null default 0;

create or replace function public.increment_serper_usage(
  p_user_id uuid,
  p_month_key text,
  p_delta int default 1
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count int;
begin
  insert into public.usage_monthly (user_id, month_key, serper_api_calls)
  values (p_user_id, p_month_key, p_delta)
  on conflict (user_id, month_key)
  do update set
    serper_api_calls = usage_monthly.serper_api_calls + excluded.serper_api_calls,
    updated_at = now()
  returning serper_api_calls into new_count;
  return new_count;
end;
$$;
