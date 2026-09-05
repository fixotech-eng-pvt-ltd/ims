-- Quick fix: the pre-existing `orders` table was missing its base columns, so
-- order inserts failed with "column orders.quote_no does not exist".
-- Run this ONCE in Supabase → SQL Editor (safe / idempotent). Then the app's
-- order history will sync. (This is already folded into schema.sql too.)
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
