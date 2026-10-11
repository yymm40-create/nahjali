-- «لأجل المهدي» · the redesign: the four new looks, and the home screen the person arranges.
alter table public.mahdi_profiles drop constraint if exists mahdi_profiles_theme_check;
alter table public.mahdi_profiles add constraint mahdi_profiles_theme_check
  check (theme in ('cinematic', 'aurora', 'neon', 'pop', 'minimal', 'night'));
alter table public.mahdi_profiles alter column theme set default 'aurora';
-- the home cards in order (null = the standard home)
alter table public.mahdi_profiles add column if not exists home_widgets text[];
