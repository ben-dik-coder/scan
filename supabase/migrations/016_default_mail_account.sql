-- Standard e-postkonto for sending (når bruker har flere koblet)
alter table public.user_settings
  add column if not exists default_mail_account_id uuid;
