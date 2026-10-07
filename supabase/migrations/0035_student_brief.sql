-- «الطالب الذكي»: the first page's answers — what the material is for, and whether Claude researches it.
-- The site works before this runs (a material simply has no saved purpose); run it once in the SQL editor.
alter table public.student_projects add column if not exists brief jsonb not null default '{}'::jsonb;
