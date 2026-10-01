-- Supabase-only: row-level security. Run after schema.sql.
--
-- Users may READ their own rows. All writes come from the server using the
-- service-role key (which bypasses RLS), so there are deliberately no
-- insert/update/delete policies for the `authenticated` role.

alter table email_accounts      add constraint email_accounts_user_fk
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table email_accounts      enable row level security;
alter table processed_emails    enable row level security;
alter table subscriptions       enable row level security;
alter table subscription_events enable row level security;
alter table subscription_audit  enable row level security;
alter table review_items        enable row level security;
alter table processing_log      enable row level security;
alter table sync_state          enable row level security;

create policy "own accounts" on email_accounts
  for select to authenticated using (user_id = auth.uid());

create policy "own subscriptions" on subscriptions
  for select to authenticated using (
    exists (select 1 from email_accounts a where a.id = subscriptions.account_id and a.user_id = auth.uid()));

create policy "own events" on subscription_events
  for select to authenticated using (
    exists (select 1 from email_accounts a where a.id = subscription_events.account_id and a.user_id = auth.uid()));

create policy "own audit" on subscription_audit
  for select to authenticated using (
    exists (select 1 from email_accounts a where a.id = subscription_audit.account_id and a.user_id = auth.uid()));

create policy "own review items" on review_items
  for select to authenticated using (
    exists (select 1 from email_accounts a where a.id = review_items.account_id and a.user_id = auth.uid()));

-- processed_emails, processing_log and sync_state stay server-only (no select policy).