-- Trial-nudges + hyppigere markedsvarsel

alter table public.user_settings
  add column if not exists trial_nudges_sent jsonb not null default '{}'::jsonb;

comment on column public.user_settings.trial_nudges_sent is
  'Hvilke prøve-dager (3,5,7) som har fått e-post, f.eks. {"3":true}';
