-- Flere e-postkontoer per bruker (f.eks. to Outlook via OAuth)
alter table public.user_mail_accounts
  drop constraint if exists user_mail_accounts_user_id_provider_key;

alter table public.user_mail_accounts
  add constraint user_mail_accounts_user_id_email_key unique (user_id, email);
