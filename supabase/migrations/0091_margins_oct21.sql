-- The owner's margins of 21 October 2026, written into the dashboard's settings (/admin/limits) so they hold even if
-- older numbers were saved there: the general margin 40٪ (the other picture models, sound, fixed fees), GPT Image 2's
-- pictures 30٪, videos 40٪, and the struck «كان» price 70٪ (30 points above the general, as before).
-- Claude's 40٪, «حيدرا ماكس»'s 70٪ and «سيدنس الواقعي»'s 10٪ are fixed in the code (config/claude-models.ts,
-- config/jawad/generators.ts) and need nothing here.
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run.

insert into public.film_limits (scope, target, key, value) values
  ('all', '', 'price_margin_pct', 40),
  ('all', '', 'price_image_margin_pct', 30),
  ('all', '', 'price_video_margin_pct', 40),
  ('all', '', 'price_was_margin_pct', 70)
on conflict (scope, target, key) do update set value = excluded.value, updated_at = now();
