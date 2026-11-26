-- «لأجل المهدي»: «أيام العذر والقضاء» (habits without guilt, approved by the owner on 26 November 2026).
--
-- One row per day the person marked: an excuse day (travel, illness, the shar'i excuse — at most two a week, checked by the app),
-- a day of a pause (up to 14 days in a row), or «قضاء» (a missed day made up later). Excused days never break the day streak; a
-- missed day is drawn soft orange, never red. Until this runs, the app keeps the marks on the person's device. Safe to run twice.

create table if not exists public.mahdi_day_marks (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('travel', 'illness', 'shari', 'pause', 'qada')),
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.mahdi_day_marks enable row level security;
drop policy if exists "mahdi day marks: own rows" on public.mahdi_day_marks;
create policy "mahdi day marks: own rows" on public.mahdi_day_marks
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.mahdi_day_marks from anon;
grant select, insert, update, delete on public.mahdi_day_marks to authenticated;

notify pgrst, 'reload schema';
