-- «الجواد الذكي!» | JAWAD AI · «الخطيب الذكي»: the library holds two kinds of references — poetry («أشعار») and sources
-- («مصدر»: stories, wisdom, lessons…, like «من شواهد المبلغين») — and a reference can come from a website's own text.
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run again.
alter table public.khateeb_refs add column if not exists kind text not null default 'poetry' check (kind in ('poetry', 'source'));
alter table public.khateeb_refs add column if not exists origin text not null default '';
