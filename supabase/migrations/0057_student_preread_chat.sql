-- «الطالب الذكي»: two more outputs — «قراءة ما قبل الدرس» (preread) and «محادثة مع صادق» (chat).
alter table public.student_outputs drop constraint if exists student_outputs_kind_check;
alter table public.student_outputs add constraint student_outputs_kind_check
  check (kind in ('summary', 'explain', 'preread', 'transcript', 'book', 'slides', 'audio', 'quiz', 'chat'));
