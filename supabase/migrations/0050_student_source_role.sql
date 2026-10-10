-- «الطالب الذكي»: what each source IS to the student, not just that it exists.
-- 'material'  = the scientific material itself (the default, which is how every source before this was treated)
-- 'template'  = a file whose SHAPE is to be followed (its sections, order, headings, numbering, length, tone)
-- 'reference' = extra background, used only when it adds something
alter table student_sources add column if not exists role text not null default 'material';
alter table student_sources drop constraint if exists student_sources_role_check;
alter table student_sources add constraint student_sources_role_check check (role in ('material', 'template', 'reference'));
