-- Tillat NyLead som plan (én pakke); behold eldre planer for eksisterende abonnement
alter table public.profiles drop constraint if exists profiles_plan_check;

alter table public.profiles
  add constraint profiles_plan_check
  check (plan in ('nylead', 'start', 'pro', 'agency'));

comment on column public.profiles.plan is 'nylead | start | pro | agency (eldre)';
