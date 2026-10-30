-- Contact form messages from the website's "Email us" form.
-- Run once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
--
-- RLS is on. The site's publishable (anon) key may only insert rows that match
-- the form's own validation; it can never read, change or delete them.

create table if not exists public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(name) between 1 and 80),
  email      text not null check (length(email) between 3 and 254),
  subject    text not null check (subject in ('General question', 'Support', 'Feedback', 'Partnership')),
  message    text not null check (length(message) between 10 and 4000),
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

grant insert on public.contact_messages to anon;
drop policy if exists "website can add contact messages" on public.contact_messages;
create policy "website can add contact messages" on public.contact_messages
  for insert to anon
  with check (true);
