-- «الأكواد»: a code can carry a GIFT for whoever enters it (once per person): points in their wallet, every purchase at
-- the tool's own cost (no profit), a ceiling on the Claude model they may use, and a number of Seedance 2.0 generations.
-- gift_sar: riyals put in the wallet at the first entry (the wallet counts halalas; the server multiplies by 100)
-- at_cost: whoever entered the code (while it still opens) pays the cost of what they buy, with no margin
-- claude_model: the dearest Claude model they may use (fable | opus | sonnet | haiku); a dearer pick is served by this one
-- video_gens: at most this many Seedance 2.0 generations (JAWAD AI and the film maker together); empty = no ceiling
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run (after 0041). Safe to run again.

alter table public.site_codes add column if not exists gift_sar integer not null default 0 check (gift_sar between 0 and 1000);
alter table public.site_codes add column if not exists at_cost boolean not null default false;
alter table public.site_codes add column if not exists claude_model text check (claude_model is null or claude_model in ('fable', 'opus', 'sonnet', 'haiku'));
alter table public.site_codes add column if not exists video_gens integer check (video_gens is null or video_gens between 0 and 1000);

-- what was put in this person's wallet by this code (halalas): the gift is given once, when their entry is first recorded
alter table public.site_code_uses add column if not exists gifted_halalas integer not null default 0;
