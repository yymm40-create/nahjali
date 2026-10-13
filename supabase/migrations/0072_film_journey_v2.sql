-- The unified Sajjad-first journey for a short scene, cinematic film and series.
-- Existing work stays on v1 until its owner reviews and confirms the conversion.
alter table public.film_projects add column if not exists workflow_version integer;
update public.film_projects set workflow_version = 1 where workflow_version is null;
alter table public.film_projects alter column workflow_version set default 2;
alter table public.film_projects alter column workflow_version set not null;
alter table public.film_projects drop constraint if exists film_projects_workflow_version_check;
alter table public.film_projects add constraint film_projects_workflow_version_check check (workflow_version in (1, 2));
alter table public.film_projects add column if not exists intake jsonb;

alter table public.film_series add column if not exists workflow_version integer;
update public.film_series set workflow_version = 1 where workflow_version is null;
alter table public.film_series alter column workflow_version set default 2;
alter table public.film_series alter column workflow_version set not null;
alter table public.film_series drop constraint if exists film_series_workflow_version_check;
alter table public.film_series add constraint film_series_workflow_version_check check (workflow_version in (1, 2));
alter table public.film_series add column if not exists intake jsonb;
