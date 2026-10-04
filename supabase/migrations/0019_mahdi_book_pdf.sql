-- «لأجل المهدي» · «القارئ العلوي»: a book can carry a PDF that readers download, and covers can be enhanced by AI.
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run (after 0018).
--
-- The file is uploaded straight from the browser to a private bucket with a one-time link made by the server
-- (large files never pass through the website), checked by the server, then attached to the book. Downloads use
-- short-lived links made by the server for signed-in readers. The owner can remove a file from /admin/mahdi.

alter table public.mahdi_books
  add column if not exists pdf_path text check (pdf_path is null or char_length(pdf_path) <= 300),
  add column if not exists pdf_size integer check (pdf_size is null or pdf_size between 1 and 52428800),
  add column if not exists pdf_added_by uuid references auth.users (id) on delete set null;

-- Private: no public links, no direct access for signed-in users (the server makes every upload and download link)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('mahdi-book-files', 'mahdi-book-files', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

-- ───────────────────────── AI uses (cover enhancement) ─────────────────────────
-- One row per use: the daily limit, and what it cost us. Server only.
create table if not exists public.mahdi_ai_uses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind ~ '^[a-z_]{1,30}$'),
  ok boolean not null default false,
  cost_usd numeric(10, 4),
  created_at timestamptz not null default now()
);
create index if not exists mahdi_ai_uses_user_idx on public.mahdi_ai_uses (user_id, kind, created_at desc);
alter table public.mahdi_ai_uses enable row level security;
revoke all on public.mahdi_ai_uses from anon, authenticated;
