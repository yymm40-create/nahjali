-- «لأجل المهدي» · «إخوة الولاية»: who sees each member's progress in a group (a member asked, 25 November 2026:
-- a group run as a competition, where each one's work is seen only by them and the leader).
--   · mahdi_groups.progress_visibility
--       'all'     — every member sees the others' progress (the group ranking, how many did each shared work).
--                   What every group did until now, so it stays the default for existing groups.
--       'leaders' — a member sees only their own progress; the leader (and admins holding «الإحصائيات») see everyone's.
-- Enforced on our server: the group tables have RLS on with no policies (0010, 0073, 0083), so clients never read
-- them directly; the API trims what it sends to each member. Nothing else (no SQL function) returns group data to
-- clients, so nothing else changes here.
-- Run in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run twice.

alter table public.mahdi_groups add column if not exists progress_visibility text not null default 'all';
alter table public.mahdi_groups drop constraint if exists mahdi_groups_progress_visibility_check;
alter table public.mahdi_groups add constraint mahdi_groups_progress_visibility_check
  check (progress_visibility in ('all', 'leaders'));

comment on column public.mahdi_groups.progress_visibility is
  'all = members see each other''s progress (default); leaders = a member sees only their own, the leader and admins with «الإحصائيات» see everyone''s';

-- the API reads the new column at once (no stale schema cache)
notify pgrst, 'reload schema';
