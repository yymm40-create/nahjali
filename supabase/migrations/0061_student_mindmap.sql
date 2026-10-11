-- «الطالب الذكي» · «خريطة ذهنية»: a new output kind (mind maps drawn by صادق or by GPT Image 2, with a blank recall copy).
alter table public.student_outputs drop constraint if exists student_outputs_kind_check;
alter table public.student_outputs add constraint student_outputs_kind_check
  check (kind in ('summary','explain','preread','transcript','book','slides','audio','quiz','chat','mindmap'));
