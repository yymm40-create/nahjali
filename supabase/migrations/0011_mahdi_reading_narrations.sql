-- «متعلّم على سبيل نجاة»: books counted by narrations (روايات), such as al-Kafi.
-- Run once in Supabase after 0010: Dashboard → SQL Editor → paste → Run.
--
-- A book is now counted in pages (as before) or in numbered narrations. `pages` holds the total either way, and
-- sessions keep their numbers in the same columns; only the meaning changes with the book's unit.
-- Reading goals and the linked habit can also be measured in narrations.

alter table public.mahdi_books
  add column unit text not null default 'page' check (unit in ('page', 'narration'));

alter table public.mahdi_reading_goals drop constraint if exists mahdi_reading_goals_daily_metric_check;
alter table public.mahdi_reading_goals drop constraint if exists mahdi_reading_goals_weekly_metric_check;
alter table public.mahdi_reading_goals drop constraint if exists mahdi_reading_goals_habit_metric_check;
alter table public.mahdi_reading_goals
  add constraint mahdi_reading_goals_daily_metric_check check (daily_metric is null or daily_metric in ('minutes', 'pages', 'narrations')),
  add constraint mahdi_reading_goals_weekly_metric_check check (weekly_metric is null or weekly_metric in ('minutes', 'pages', 'narrations')),
  add constraint mahdi_reading_goals_habit_metric_check check (habit_metric in ('minutes', 'pages', 'narrations'));
