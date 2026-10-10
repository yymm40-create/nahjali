-- «الفيلم السينمائي أو المشهد القصير»: what a film project is being made as.
-- 'scene' = a short scene that stands on its own (how every project before this was made, so it is the default),
-- 'film'  = a whole cinematic film of several scenes. A series has its own tables («المسلسل الذكي»).
alter table film_projects add column if not exists kind text not null default 'scene';
alter table film_projects drop constraint if exists film_projects_kind_check;
alter table film_projects add constraint film_projects_kind_check check (kind in ('scene', 'film'));
