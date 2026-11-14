-- «لأجل المهدي» · «القارئ العلوي»: a book can have up to 100,000 pages (was 10,000) — big multi-volume books in one
-- file, like «الكافي» (11,799 pages) and «الصحيح من سيرة النبي الأعظم» (12,675). The owner, 14 November 2026.
-- Run in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run twice.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.mahdi_books'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ~ '\mpages\M' and pg_get_constraintdef(oid) like '%10000%'
  loop
    execute format('alter table public.mahdi_books drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.mahdi_books drop constraint if exists mahdi_books_pages_check;
alter table public.mahdi_books add constraint mahdi_books_pages_check check (pages between 1 and 100000);
