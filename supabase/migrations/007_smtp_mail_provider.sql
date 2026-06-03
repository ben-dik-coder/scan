-- Outlook/Hotmail via SMTP (app-passord) — ingen Azure-oppsett
alter table public.user_mail_accounts
  drop constraint if exists user_mail_accounts_provider_check;

alter table public.user_mail_accounts
  add constraint user_mail_accounts_provider_check
  check (provider in ('google', 'microsoft', 'smtp'));
