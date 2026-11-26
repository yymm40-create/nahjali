-- «لأجل المهدي» · the plan «واجهة لأجل المهدي الجديدة» (approved 26 November 2026): the new design «شمس وبرتقال»
-- ('sun') is offered and becomes the look a new account starts with. The 23 designs stay, every one light now.
alter table public.mahdi_profiles drop constraint if exists mahdi_profiles_theme_check;
alter table public.mahdi_profiles add constraint mahdi_profiles_theme_check
  check (theme in ('rings', 'bars', 'liquid', 'buttons', 'heatmap', 'bento', 'pop', 'garden', 'path', 'flame',
                   'gauge', 'swipe', 'timeline', 'cells', 'rpg', 'aurora', 'neon', 'journal', 'zakhrafa', 'mono',
                   'cinematic', 'minimal', 'night', 'sun'));
alter table public.mahdi_profiles alter column theme set default 'sun';
