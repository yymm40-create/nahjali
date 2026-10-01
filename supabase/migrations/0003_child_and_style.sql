-- Child personalization + chosen art style.
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run.

alter table public.orders
  add column child_name text check (char_length(child_name) between 1 and 30),
  add column child_gender text check (child_gender in ('boy', 'girl')),
  add column style text not null default 'pixar';
