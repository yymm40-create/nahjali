-- «لأجل المهدي» · «القارئ العلوي» → «مسبار القارئ» (الشيخ حسن البلوشي): a reading guide of 342 books in three dimensions,
-- 13 fields and 3 levels. The guide itself ships with the site (src/lib/mahdi/guide/data.json); the database keeps:
--   · mahdi_guide_list   — my list in the guide: «أريد قراءته / أقرؤه الآن / أنهيته» and my note on each book.
--   · mahdi_guide_books  — a guide book the owner gave a PDF: it points at a book of the shared catalogue (mahdi_books),
--                          whose PDF opens in the reader inside the platform.
--   · mahdi_pdf_progress — the last page I reached in a book's PDF, so the reader opens where I stopped (any device).
-- Run in Supabase: Dashboard → SQL Editor → paste → Run (after 0019). Safe to run twice (run it again if you ran it before the size part was added).
-- The guide works before it runs (the list then stays on the device, and no guide book has a PDF yet).

create table if not exists public.mahdi_guide_list (
  user_id uuid not null references auth.users (id) on delete cascade,
  guide_id text not null check (guide_id ~ '^[a-z]{2,20}-[0-9]{1,4}$'),
  status text check (status is null or status in ('want', 'now', 'read')),
  note text not null default '' check (char_length(note) <= 1000),
  updated_at timestamptz not null default now(),
  primary key (user_id, guide_id)
);

create table if not exists public.mahdi_guide_books (
  guide_id text primary key check (guide_id ~ '^[a-z]{2,20}-[0-9]{1,4}$'),
  book_id uuid not null references public.mahdi_books (id) on delete cascade,
  linked_by uuid references auth.users (id) on delete set null,
  linked_at timestamptz not null default now()
);
create index if not exists mahdi_guide_books_book_idx on public.mahdi_guide_books (book_id);

create table if not exists public.mahdi_pdf_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id uuid not null references public.mahdi_books (id) on delete cascade,
  page integer not null check (page between 1 and 100000),
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

alter table public.mahdi_guide_list enable row level security;
alter table public.mahdi_guide_books enable row level security;
alter table public.mahdi_pdf_progress enable row level security;

drop policy if exists "mahdi guide list: own rows" on public.mahdi_guide_list;
create policy "mahdi guide list: own rows" on public.mahdi_guide_list
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- Which guide books have a PDF: every signed-in reader may see; only the server (the owner's page) writes
drop policy if exists "mahdi guide books: signed-in users read" on public.mahdi_guide_books;
create policy "mahdi guide books: signed-in users read" on public.mahdi_guide_books
  for select to authenticated using (true);
drop policy if exists "mahdi pdf progress: own rows" on public.mahdi_pdf_progress;
create policy "mahdi pdf progress: own rows" on public.mahdi_pdf_progress
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.mahdi_guide_list, public.mahdi_guide_books, public.mahdi_pdf_progress from anon;
grant select, insert, update, delete on public.mahdi_guide_list, public.mahdi_pdf_progress to authenticated;
grant select on public.mahdi_guide_books to authenticated;

-- ───────────────────────── No size limit on a book's PDF (the owner, 10 November 2026) ─────────────────────────
-- 0019 capped a book's file at 50 MB. Now any size: the column takes big files (bigint) and only checks it is a real size.
-- (Files live in R2; the old Supabase bucket's own cap goes too, for any upload that still lands there.)
alter table public.mahdi_books drop constraint if exists mahdi_books_pdf_size_check;
alter table public.mahdi_books alter column pdf_size type bigint;
alter table public.mahdi_books add constraint mahdi_books_pdf_size_check check (pdf_size is null or pdf_size > 0);
update storage.buckets set file_size_limit = null where id = 'mahdi-book-files';
