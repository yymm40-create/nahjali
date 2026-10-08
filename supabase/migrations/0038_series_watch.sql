-- «رقابة الاستمرارية»: سجاد's alerts about what's missing between a series' scenes, each open / done / dismissed
-- ({"alerts":[{id,sceneId,where,severity,title,text,fix,status,at}],"checked":{sceneId: when}}). Run once after
-- 0037. Safe to run again.
alter table public.film_series add column if not exists watch jsonb not null default '{"alerts":[]}'::jsonb;
