-- Waitlist signups for the marketing site.
-- Run once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
--
-- The website inserts rows from the server with the service-role key, which
-- bypasses row-level security. RLS is on with no policies, so the public
-- anon key can neither read nor write this table.

create table if not exists public.waitlist_signups (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique check (email = lower(email)),
  source     text not null default 'landing-waitlist',
  created_at timestamptz not null default now()
);

alter table public.waitlist_signups enable row level security;

-- Only needed when the site uses the publishable (anon) key instead of the
-- secret key: lets it add signups, but never read, change or delete them.
grant insert on public.waitlist_signups to anon;
drop policy if exists "website can add waitlist signups" on public.waitlist_signups;
create policy "website can add waitlist signups" on public.waitlist_signups
  for insert to anon
  with check (
    email = lower(email)
    and length(email) between 3 and 254
    and source in ('hero', 'cta', 'footer', 'landing-waitlist')
  );
