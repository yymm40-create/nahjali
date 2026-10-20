-- «لأجل المهدي» · «الختمة العلوية»: the reader's clock and its settings.
--   mahdi_quran_time: the seconds a person spent reading in the reader each day (the counter at the top of the reader).
--   mahdi_quran_reader: the habit that reading time fills (minutes added to it), and the page they free-read last.
-- Server-only like the khatma tables (RLS on, nothing granted): the pages reach it through the API.
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run again.
create table if not exists public.mahdi_quran_time (
  user_id uuid not null references auth.users (id) on delete cascade,
  read_on date not null,
  seconds integer not null default 0 check (seconds between 0 and 86400),
  updated_at timestamptz not null default now(),
  primary key (user_id, read_on)
);

create table if not exists public.mahdi_quran_reader (
  user_id uuid primary key references auth.users (id) on delete cascade,
  time_habit_id uuid references public.mahdi_habits (id) on delete set null,
  free_page smallint check (free_page between 1 and 604),
  updated_at timestamptz not null default now()
);

alter table public.mahdi_quran_time enable row level security;
alter table public.mahdi_quran_reader enable row level security;
revoke all on public.mahdi_quran_time from anon, authenticated;
revoke all on public.mahdi_quran_reader from anon, authenticated;
