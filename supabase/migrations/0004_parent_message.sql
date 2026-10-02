-- Optional message from the parents, printed on the "هذا أنا" page.
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run.

alter table public.orders
  add column parent_message text check (char_length(parent_message) <= 140);
