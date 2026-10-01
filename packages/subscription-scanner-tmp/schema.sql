-- Trace subscription engine schema (PostgreSQL 14+ / Supabase).
--
-- Design notes
--  * Every id is deterministic text produced by the app (see src/dedup/identity.ts),
--    so re-processing an email collides with its own earlier rows instead of duplicating them.
--  * subscription_events is the source of truth; subscriptions is a projection that can be
--    rebuilt from it at any time.
--  * Email bodies are never stored. Only the metadata needed for dedup and audit is kept.
--  * OAuth tokens are NOT stored here; they belong in a separate, server-only, encrypted store.
--  * Some foreign keys are DEFERRABLE INITIALLY DEFERRED because one email's rows are written
--    in a single transaction and are only checked at COMMIT.

create table if not exists email_accounts (
  id            text primary key,
  user_id       uuid not null,            -- on Supabase: references auth.users(id) on delete cascade
  provider      text not null,            -- 'gmail', 'outlook', …
  email_address text not null,
  created_at    timestamptz not null default now(),
  unique (provider, email_address)
);

-- Ledger: one row per email the engine has looked at, whatever the outcome.
create table if not exists processed_emails (
  id                    text primary key,
  account_id            text not null references email_accounts(id) on delete cascade,
  provider              text not null,
  provider_message_id   text not null,
  internet_message_id   text,
  fingerprint           text,
  received_at           timestamptz,
  from_address          text,
  subject               text,
  status                text not null check (status in ('processed', 'ignored', 'needs_review', 'duplicate', 'failed')),
  event_type            text,
  classification_score  real,
  subscription_id       text,
  event_id              text,
  duplicate_of          text references processed_emails(id) deferrable initially deferred,
  attempts              integer not null default 0 check (attempts >= 0),
  last_error            text,
  rules_version         text not null,
  processed_at          timestamptz not null default now(),
  unique (account_id, provider, provider_message_id)
);
-- The same email can't be analysed twice under different provider ids.
create unique index if not exists processed_emails_message_id_uq
  on processed_emails (account_id, internet_message_id)
  where internet_message_id is not null and status not in ('duplicate', 'failed');
create unique index if not exists processed_emails_fingerprint_uq
  on processed_emails (account_id, fingerprint)
  where fingerprint is not null and status not in ('duplicate', 'failed');
create index if not exists processed_emails_retry_idx
  on processed_emails (account_id, processed_at) where status = 'failed';

-- Projection of each subscription's events (rebuildable).
create table if not exists subscriptions (
  id                      text primary key,
  account_id              text not null references email_accounts(id) on delete cascade,
  provider_key            text not null,
  provider_name           text not null,
  billed_via              text,
  plan_name               text,
  status                  text not null check (status in ('active', 'trialing', 'past_due', 'cancelled', 'expired', 'unknown')),
  start_date              date,
  renewal_date            date,
  renewal_date_estimated  boolean not null default false,
  expiration_date         date,
  cancellation_date       date,
  billing_frequency       text check (billing_frequency in ('weekly', 'monthly', 'quarterly', 'semiannual', 'annual')),
  price_minor             bigint check (price_minor >= 0),
  currency                char(3),
  previous_price_minor    bigint check (previous_price_minor >= 0),
  previous_currency       char(3),
  is_trial                boolean not null default false,
  trial_end_date          date,
  last_payment_date       date,
  needs_review            boolean not null default false,
  created_from_email_id   text not null references processed_emails(id) deferrable initially deferred,
  last_email_id           text,
  last_event_at           timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  check ((price_minor is null) = (currency is null)),
  check ((previous_price_minor is null) = (previous_currency is null))
);
create index if not exists subscriptions_provider_idx on subscriptions (account_id, provider_key);

-- Source of truth: what each email said happened. One event per email, enforced here.
create table if not exists subscription_events (
  id               text primary key,
  account_id       text not null references email_accounts(id) on delete cascade,
  email_id         text not null unique references processed_emails(id) deferrable initially deferred,
  subscription_id  text references subscriptions(id) on delete cascade deferrable initially deferred,
  event_type       text not null check (event_type in ('subscription_started', 'trial_started', 'trial_ending',
                     'renewal_reminder', 'payment_succeeded', 'payment_failed', 'plan_changed', 'price_changed',
                     'cancelled', 'expiring', 'expired')),
  occurred_at      timestamptz not null,
  data             jsonb not null,
  confidence       real not null,
  review_reasons   text[] not null default '{}',
  created_at       timestamptz not null default now()
);
create index if not exists subscription_events_replay_idx on subscription_events (subscription_id, occurred_at, id);

-- Audit trail: which email created/updated which subscription and what changed.
create table if not exists subscription_audit (
  id               text primary key,
  account_id       text not null references email_accounts(id) on delete cascade,
  subscription_id  text not null references subscriptions(id) on delete cascade deferrable initially deferred,
  email_id         text not null references processed_emails(id) deferrable initially deferred,
  event_id         text not null references subscription_events(id) deferrable initially deferred,
  action           text not null check (action in ('created', 'updated', 'unchanged')),
  changes          jsonb not null default '{}',
  created_at       timestamptz not null default now()
);
create index if not exists subscription_audit_subscription_idx on subscription_audit (subscription_id, created_at);

-- Things a person should confirm instead of the engine guessing.
create table if not exists review_items (
  id               text primary key,
  account_id       text not null references email_accounts(id) on delete cascade,
  email_id         text not null references processed_emails(id) deferrable initially deferred,
  event_id         text references subscription_events(id) deferrable initially deferred,
  subscription_id  text references subscriptions(id) on delete cascade deferrable initially deferred,
  reason           text not null,
  details          jsonb not null default '{}',
  status           text not null default 'open' check (status in ('open', 'resolved')),
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz
);
create index if not exists review_items_open_idx on review_items (account_id, subscription_id) where status = 'open';

-- Operational log: successes and errors per email and per sync.
create table if not exists processing_log (
  id          bigint generated always as identity primary key,
  account_id  text not null,
  email_id    text,
  level       text not null check (level in ('info', 'warn', 'error')),
  stage       text not null,
  message     text not null,
  details     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists processing_log_account_idx on processing_log (account_id, created_at desc);

-- Where each mailbox's sync left off.
create table if not exists sync_state (
  account_id                 text primary key references email_accounts(id) on delete cascade,
  phase                      text not null check (phase in ('initial', 'incremental')),
  checkpoint                 text,
  scan_since                 timestamptz,
  scan_page_token            text,
  initial_scan_completed_at  timestamptz,
  last_synced_at             timestamptz,
  updated_at                 timestamptz not null default now()
);