-- «لأجل المهدي» · the twenty designs the person chooses between (and «الحرم», and the two older looks).
alter table public.mahdi_profiles drop constraint if exists mahdi_profiles_theme_check;
alter table public.mahdi_profiles add constraint mahdi_profiles_theme_check
  check (theme in ('rings', 'bars', 'liquid', 'buttons', 'heatmap', 'bento', 'pop', 'garden', 'path', 'flame',
                   'gauge', 'swipe', 'timeline', 'cells', 'rpg', 'aurora', 'neon', 'journal', 'zakhrafa', 'mono',
                   'cinematic', 'minimal', 'night'));
-- the home layout of 0062, in case 0062 was not run
alter table public.mahdi_profiles add column if not exists home_widgets text[];
