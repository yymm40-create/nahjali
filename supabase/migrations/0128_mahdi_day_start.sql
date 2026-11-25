-- «لأجل المهدي» · «بداية يومي» (the owner, 25 November 2026; a member complained the date changed only at 6:00): each person
-- decides when their day starts. By default at Fajr prayer in their area (worked out in the app, the Ja'fari method, 16°);
-- or at midnight; or at a time they pick (00:00 to 12:00). The area is a city from the app's list or their location once,
-- rounded to 2 decimals (about a kilometre). Until they pick, the main city of their time zone is used. Dates already
-- logged stay as they are: only which date «now» belongs to changes.
-- Before this runs, the app keeps working: everyone's day starts at Fajr of their time zone's main city.
-- Run in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run twice.

alter table public.mahdi_profiles add column if not exists day_start_mode text not null default 'fajr';
alter table public.mahdi_profiles add column if not exists day_start_at text;
alter table public.mahdi_profiles add column if not exists day_lat double precision;
alter table public.mahdi_profiles add column if not exists day_lng double precision;
alter table public.mahdi_profiles add column if not exists day_city text;

alter table public.mahdi_profiles drop constraint if exists mahdi_profiles_day_start_check;
alter table public.mahdi_profiles add constraint mahdi_profiles_day_start_check check (
  day_start_mode in ('fajr', 'midnight', 'custom')
  and (day_start_at is null or day_start_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
  and (day_start_mode <> 'custom' or day_start_at is not null)
  and (day_lat is null or day_lat between -90 and 90)
  and (day_lng is null or day_lng between -180 and 180)
  and ((day_lat is null) = (day_lng is null))
  and (day_city is null or length(day_city) <= 40)
);

-- written only by the site's server (with its own key), like the other settings since 0029: no grant to the person's key
