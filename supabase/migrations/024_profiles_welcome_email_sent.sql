-- Track one-time welcome email after email confirmation
alter table public.profiles
  add column if not exists welcome_email_sent_at timestamptz;

comment on column public.profiles.welcome_email_sent_at is
  'When the post-confirmation welcome email was sent (null = not sent yet)';
