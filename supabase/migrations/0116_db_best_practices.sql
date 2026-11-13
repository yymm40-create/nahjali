-- «قاعدة البيانات أسرع» (14 November 2026): Supabase's Postgres best practices applied to the platform.
-- Safe to run more than once. Every index is IF NOT EXISTS; the tables are small, so plain CREATE INDEX takes
-- a moment (no long lock). Nothing here changes data or what anyone may read.

-- 1) Columns the code looks rows up by, or that a delete cascades through, with no index leading on them
--    (a full table scan each time, growing with the table):

-- the film maker totals a project's cost (its job_id is already unique, so indexed)
create index if not exists film_usage_project_idx on public.film_usage (project_id);
-- a film job by the video or picture it makes; the versions' assets (and «رجّع مبلغ كلود» finds a reply's assets by them)
create index if not exists film_jobs_asset_idx on public.film_jobs (asset_id) where asset_id is not null;
create index if not exists film_assets_version_idx on public.film_assets (version_id) where version_id is not null;
-- «رجّع مبلغ كلود»: a film reply's versions by its job, and a robot turn's studio jobs by its ledger ref
create index if not exists film_versions_reply_job_idx on public.film_versions ((data ->> 'job_id')) where data ? 'job_id';
create index if not exists jawad_job_events_claude_ref_idx on public.jawad_job_events ((detail ->> 'ref')) where type = 'claude_prompt';
-- deleting a studio job (the clean-up) cascades into the library and the gallery
create index if not exists jawad_library_job_idx on public.jawad_library (job_id) where job_id is not null;
create index if not exists jawad_library_upload_idx on public.jawad_library (upload_id);
create index if not exists jawad_gallery_job_idx on public.jawad_gallery (job_id);
-- a person's own files in محمد باقر, كاظم and زهراء (listed by user)
create index if not exists content_files_user_idx on public.content_files (user_id, created_at desc);
create index if not exists designer_files_user_idx on public.designer_files (user_id, created_at desc);
create index if not exists photo_files_user_idx on public.photo_files (user_id, created_at desc);
-- a member's movements in a team wallet
create index if not exists team_coin_ledger_user_idx on public.team_coin_ledger (user_id, created_at desc);
-- «الطالب الذكي»: its tables are read through the policy «read own» (user_id = the person)
create index if not exists student_outputs_user_idx on public.student_outputs (user_id);
create index if not exists student_sources_user_idx on public.student_sources (user_id);
create index if not exists student_segments_user_idx on public.student_segments (user_id);
create index if not exists student_versions_user_idx on public.student_versions (user_id);
-- «لأجل المهدي»: who viewed which story
create index if not exists mahdi_story_views_user_idx on public.mahdi_story_views (user_id);

-- 2) Row Level Security: a policy that calls auth.uid() bare runs it again for EVERY row it checks; wrapped as
--    (select auth.uid()) Postgres runs it once per query (Supabase: 5–10× faster on big tables). The rule each policy
--    enforces stays exactly the same: only the call is wrapped, read from the live policy itself, in this schema only.
do $$
declare
  p record;
  wrapped text := '( SELECT auth.uid() AS uid)';
  q text;
  c text;
  sql text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (replace(coalesce(qual, ''), wrapped, '') like '%auth.uid()%'
        or replace(coalesce(with_check, ''), wrapped, '') like '%auth.uid()%')
  loop
    -- keep the calls already wrapped, wrap the rest
    q := replace(replace(replace(p.qual, wrapped, '§uid§'), 'auth.uid()', '(select auth.uid())'), '§uid§', wrapped);
    c := replace(replace(replace(p.with_check, wrapped, '§uid§'), 'auth.uid()', '(select auth.uid())'), '§uid§', wrapped);
    sql := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if q is not null then sql := sql || format(' using (%s)', q); end if;
    if c is not null then sql := sql || format(' with check (%s)', c); end if;
    execute sql;
  end loop;
end $$;
