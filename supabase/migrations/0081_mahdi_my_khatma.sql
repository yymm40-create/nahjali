-- «لأجل المهدي» · «الختمة العلوية» · «ختمتي»: a person's own khatma of the Quran, read hizb quarter by hizb quarter
-- (240), at their own pace (finish in N days), optionally linked to one of their habits (each quarter read adds to it).
-- Server-only, like the group khatma (0080): the server checks the account on every read and write.
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run (after 0080). Safe to run again.

create table if not exists public.mahdi_my_khatmas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  number integer not null check (number >= 1),
  days smallint not null default 30 check (days between 1 and 365),
  started_on date not null,
  status text not null default 'open' check (status in ('open', 'done', 'stopped')),
  finished_on date,
  dedicated_to text not null default '' check (char_length(dedicated_to) <= 120),
  for_soul_of text not null default '' check (char_length(for_soul_of) <= 120),
  habit_id uuid references public.mahdi_habits (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, number)
);
create index if not exists mahdi_my_khatmas_user_idx on public.mahdi_my_khatmas (user_id, number desc);

-- One row per quarter read in a khatma, with the person's day it was read on.
create table if not exists public.mahdi_my_khatma_reads (
  khatma_id uuid not null references public.mahdi_my_khatmas (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  quarter smallint not null check (quarter between 1 and 240),
  read_on date not null,
  read_at timestamptz not null default now(),
  primary key (khatma_id, quarter)
);
create index if not exists mahdi_my_khatma_reads_user_day_idx on public.mahdi_my_khatma_reads (user_id, read_on);

alter table public.mahdi_my_khatmas enable row level security;
alter table public.mahdi_my_khatma_reads enable row level security;

-- No direct policies: reads and writes go through the server, which checks the account.
revoke all on public.mahdi_my_khatmas, public.mahdi_my_khatma_reads from anon, authenticated;
