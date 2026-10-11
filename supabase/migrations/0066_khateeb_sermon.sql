-- «الجواد الذكي!» | JAWAD AI · «الخطيب الذكي»: «خطبة المنبر», a new output kind of the hidden branch.
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run again.
alter table public.student_outputs drop constraint if exists student_outputs_kind_check;
alter table public.student_outputs add constraint student_outputs_kind_check
  check (kind in ('summary','explain','preread','transcript','book','slides','audio','quiz','chat','mindmap','sermon'));
