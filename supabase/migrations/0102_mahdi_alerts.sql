-- «لأجل المهدي» · «اجعله تنبيهًا»: any habit, priority, task or planner event can be made a phone notification at
-- its time. Priorities and tasks already keep `at_time` (and `notified`) in mahdi_day_tasks; habits keep
-- `reminder_time`. This adds what was missing: when a habit's own reminder was last sent (so it is sent once a day,
-- whatever the general reminder settings say), and the planner's «نبّهني» with the day it was last sent.
-- Safe to run twice. The app works before it runs (habit alerts fall back to the general settings' last send,
-- planner events simply have no bell).

alter table public.mahdi_habits add column if not exists reminder_sent_at timestamptz;

alter table public.mahdi_plan_items add column if not exists remind boolean not null default false;
alter table public.mahdi_plan_items add column if not exists reminded_on date;
create index if not exists mahdi_plan_items_remind_idx on public.mahdi_plan_items (user_id) where remind;
