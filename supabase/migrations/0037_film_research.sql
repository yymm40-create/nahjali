-- «بحث سجاد»: whether the person wanted research to develop the story (asked at the start of a film and of a series),
-- and the findings سجاد brought — each pending, approved or dropped by the person; only approved ones go into the work.
-- {"asked":"yes"|"no","items":[{id,title,text,sources,status,scope,at}]}. Run once after 0034. Safe to run again.
alter table public.film_projects add column if not exists research jsonb not null default '{"items":[]}'::jsonb;
alter table public.film_series add column if not exists research jsonb not null default '{"items":[]}'::jsonb;
