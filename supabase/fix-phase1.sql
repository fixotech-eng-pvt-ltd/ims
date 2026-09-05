-- ============================================================
-- Fixotech IMS — Phase 1 fix-up. Run ONCE in Supabase → SQL Editor.
-- Safe: `orders` alters are idempotent; activity_log/error_log are empty so
-- recreating them loses nothing. Fixes:
--   (1) orders was pre-existing with missing columns → order sync failed.
--   (2) activity_log/error_log used bigint ids but the app generates text ids.
--   (3) app_users needs a password-hash column for admin-added users.
-- ============================================================

-- (1) orders — ensure every column exists
alter table orders add column if not exists client_id text;
alter table orders add column if not exists order_date text;
alter table orders add column if not exists quote_no text;
alter table orders add column if not exists items jsonb default '[]'::jsonb;
alter table orders add column if not exists total_cost numeric;
alter table orders add column if not exists total_weight numeric;
alter table orders add column if not exists status text;
alter table orders add column if not exists created_at timestamptz default now();
alter table orders add column if not exists source text;
alter table orders add column if not exists po_ref text;
alter table orders add column if not exists ledger text;
alter table orders add column if not exists narration text;
alter table orders add column if not exists filename text;
alter table orders add column if not exists raw_text text;
create index if not exists orders_client_idx on orders (client_id);

-- (2) activity_log + error_log — text ids
drop table if exists activity_log;
create table activity_log (
  id text primary key, at timestamptz default now(),
  user_email text, app text, action text, detail jsonb default '{}'::jsonb
);
create index if not exists activity_at_idx on activity_log (at desc);

drop table if exists error_log;
create table error_log (
  id text primary key, at timestamptz default now(),
  user_email text, level text default 'error', message text, source text,
  stack text, status text default 'open', resolved_at timestamptz, data jsonb default '{}'::jsonb
);
create index if not exists error_status_idx on error_log (status, at desc);

-- (3) app_users password-hash column
alter table app_users add column if not exists pass text;

-- Re-apply RLS + the transitional "app access" policy on the recreated tables
alter table activity_log enable row level security;
drop policy if exists "app access" on activity_log;
create policy "app access" on activity_log for all to anon, authenticated using (true) with check (true);

alter table error_log enable row level security;
drop policy if exists "app access" on error_log;
create policy "app access" on error_log for all to anon, authenticated using (true) with check (true);
