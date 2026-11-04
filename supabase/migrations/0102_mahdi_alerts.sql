-- «لأجل المهدي» · «اجعله تنبيهًا»: any habit, priority, task or planner event can be made a phone notification at
-- its time. Priorities and tasks already keep `at_time` (and `notified`) in mahdi_day_tasks; habits keep
-- `reminder_time`. This adds what was missing: when a habit's own reminder was last sent (so it is sent once a day,
-- whatever the general reminder settings say), and the planner's «نبّهني» with the day it was last sent.
-- Safe to run twice, and safe before 0095 (the planner part is skipped until its table exists — run this again after
-- 0095). The app works before it runs (habit alerts fall back to one send per scheduler run, planner events have no bell).

alter table public.mahdi_habits add column if not exists reminder_sent_at timestamptz;

do $$
begin
  if to_regclass('public.mahdi_plan_items') is not null then
    alter table public.mahdi_plan_items add column if not exists remind boolean not null default false;
    alter table public.mahdi_plan_items add column if not exists reminded_on date;
    create index if not exists mahdi_plan_items_remind_idx on public.mahdi_plan_items (user_id) where remind;
  end if;
end $$;
