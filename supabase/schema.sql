-- ============================================================
-- Fixotech IMS — Supabase (PostgreSQL) schema
-- Run this ONCE in the Supabase dashboard: SQL Editor → paste → Run.
-- Safe to re-run (idempotent: IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
--
-- Model: each entity has a stable text `id` (generated in the app so offline
-- rows keep their id), a few queryable columns, and a `data jsonb` blob for the
-- rest — this mirrors the app's objects without over-normalising, and supports
-- the monitoring/admin views.
-- ============================================================

-- ---------- CLIENTS (exists — add the full column set) ----------
create table if not exists clients (
  id text primary key,
  company_name text,
  client_name text,
  phone text,
  created_at timestamptz default now()
);
alter table clients add column if not exists email text;
alter table clients add column if not exists gstin text;
alter table clients add column if not exists site_address text;
alter table clients add column if not exists billing_address text;
alter table clients add column if not exists delivery_address text;
alter table clients add column if not exists state text;
alter table clients add column if not exists notes text;
alter table clients add column if not exists updated_at timestamptz default now();

-- ---------- ORDERS (exists — ensure columns) ----------
create table if not exists orders (
  id text primary key,
  client_id text,
  order_date text,
  quote_no text,
  items jsonb default '[]'::jsonb,
  total_cost numeric,
  total_weight numeric,
  status text,
  created_at timestamptz default now()
);
-- Base columns added explicitly too: if `orders` already existed with a
-- different shape, the CREATE above is a no-op, so ensure every column exists.
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

-- ---------- SAVED QUOTES / PROFORMAS ----------
create table if not exists saved_orders (
  id text primary key, quote_no text, client_name text,
  total numeric, data jsonb default '{}'::jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists saved_proformas (
  id text primary key, pi_no text, client_name text,
  total numeric, data jsonb default '{}'::jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

-- ---------- FACTORY ----------
create table if not exists factory_indents (
  id text primary key, indent_no text, customer text,
  priority boolean default false, factory_approved boolean default false,
  data jsonb default '{}'::jsonb, updated_at timestamptz default now()
);
create table if not exists floor_sheets (
  id text primary key, kind text, customer text, indent_no text,
  img text, data jsonb default '{}'::jsonb, at timestamptz default now()
);

-- ---------- INVENTORY ----------
create table if not exists inventory_items (
  id text primary key, name text, sheet text, type text, unit text,
  opening numeric default 0, min_qty numeric default 0,
  txns jsonb default '[]'::jsonb, updated_at timestamptz default now()
);

-- ---------- DISPATCH ----------
create table if not exists dispatch_log (
  id text primary key, customer text, indent_no text,
  data jsonb default '{}'::jsonb, at timestamptz default now()
);
create table if not exists dispatch_approvals (
  indent_no text primary key, data jsonb default '{}'::jsonb, at timestamptz default now()
);

-- ---------- NOTIFICATIONS ----------
create table if not exists notifications (
  id text primary key, type text, customer text, indent_no text,
  seen boolean default false, data jsonb default '{}'::jsonb, at timestamptz default now()
);

-- ---------- CHATIQ ----------
create table if not exists chatiq_chats (
  id text primary key, title text, data jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);
create table if not exists chatiq_kb (
  key text primary key, value text, updated_at timestamptz default now()
);

-- ---------- GLOBAL SETTINGS (testing mode, shared sequence counters) ----------
create table if not exists app_settings (
  key text primary key, value jsonb, updated_at timestamptz default now()
);
insert into app_settings (key, value) values ('testing_mode', 'false'::jsonb)
  on conflict (key) do nothing;

-- ---------- ACCESS CONTROL (admin panel manages this) ----------
create table if not exists app_users (
  email text primary key,
  display_name text,
  is_admin boolean default false,
  active boolean default true,
  access jsonb default '{}'::jsonb,      -- {app: true/false, feature: true/false}
  pass text,                             -- SHA-256 password hash (never plaintext)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table app_users add column if not exists pass text;
insert into app_users (email, display_name, is_admin, active)
  values ('fixotechengs@gmail.com', 'Admin', true, true)
  on conflict (email) do update set is_admin = true, active = true;

-- ---------- MONITORING (activity feed) ----------
-- id is TEXT (app-generated) for consistency with every other table.
create table if not exists activity_log (
  id text primary key,
  at timestamptz default now(),
  user_email text, app text, action text, detail jsonb default '{}'::jsonb
);
create index if not exists activity_at_idx on activity_log (at desc);

-- ---------- FIXTECH HELP (errors / issues) ----------
create table if not exists error_log (
  id text primary key,
  at timestamptz default now(),
  user_email text, level text default 'error', message text, source text,
  stack text, status text default 'open',            -- open | resolved
  resolved_at timestamptz, data jsonb default '{}'::jsonb
);
create index if not exists error_status_idx on error_log (status, at desc);

-- ============================================================
-- ROW LEVEL SECURITY
-- Enable RLS on every table. During the transition (before the login screen
-- ships) the app uses the anon key, so policies allow anon+authenticated. Once
-- login is live, run the "HARDENING" block at the bottom to drop anon access.
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'clients','orders','saved_orders','saved_proformas','factory_indents',
    'floor_sheets','inventory_items','dispatch_log','dispatch_approvals',
    'notifications','chatiq_chats','chatiq_kb','app_settings','app_users',
    'activity_log','error_log'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "app access" on %I;', t);
    execute format(
      'create policy "app access" on %I for all to anon, authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- ============================================================
-- HARDENING (run AFTER the login screen is deployed) — restrict to logged-in
-- users only. Uncomment and run:
-- ============================================================
-- do $$
-- declare t text;
-- begin
--   foreach t in array array[
--     'clients','orders','saved_orders','saved_proformas','factory_indents',
--     'floor_sheets','inventory_items','dispatch_log','dispatch_approvals',
--     'notifications','chatiq_chats','chatiq_kb','app_settings','app_users',
--     'activity_log','error_log'
--   ] loop
--     execute format('drop policy if exists "app access" on %I;', t);
--     execute format(
--       'create policy "auth access" on %I for all to authenticated using (true) with check (true);', t);
--   end loop;
-- end $$;
