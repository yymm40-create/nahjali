-- Quality tier chosen by the customer + free-trial flag.
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run.

alter table public.orders
  add column quality text not null default 'high' check (quality in ('low', 'medium', 'high')),
  add column is_trial boolean not null default false;
