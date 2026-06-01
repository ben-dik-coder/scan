-- Billing / Stripe subscription fields on profiles
alter table public.profiles
  add column if not exists plan text check (plan in ('start', 'pro', 'agency')),
  add column if not exists subscription_status text check (
    subscription_status in (
      'active',
      'trialing',
      'past_due',
      'canceled',
      'incomplete',
      'unpaid'
    )
  ),
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_current_period_end timestamptz;

create unique index if not exists profiles_stripe_customer_id_idx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists profiles_stripe_subscription_id_idx
  on public.profiles (stripe_subscription_id)
  where stripe_subscription_id is not null;

-- Kun Stripe-webhook (service role) kan endre abonnementsfelt
create or replace function public.protect_billing_columns()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    new.plan := old.plan;
    new.subscription_status := old.subscription_status;
    new.stripe_customer_id := old.stripe_customer_id;
    new.stripe_subscription_id := old.stripe_subscription_id;
    new.subscription_current_period_end := old.subscription_current_period_end;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_billing_columns on public.profiles;
create trigger protect_billing_columns
  before update on public.profiles
  for each row
  execute function public.protect_billing_columns();

comment on column public.profiles.plan is 'start | pro | agency';
comment on column public.profiles.subscription_status is 'Stripe subscription status';
