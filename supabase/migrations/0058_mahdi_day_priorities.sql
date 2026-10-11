-- «لأجل المهدي» · «أولويات اليوم»: a list above «مهام اليوم», kept in the same table. An item is a day task marked as a
-- priority: either one of the user's habits (ticked here, the habit is filled for the day, and filled there it shows
-- ticked here) or anything new (just ticked). The app works before this runs (no priorities shown).
alter table public.mahdi_day_tasks add column if not exists priority boolean not null default false;
