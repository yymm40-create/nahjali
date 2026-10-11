-- «الجواد الذكي!» | JAWAD AI · «الخطيب الذكي»: مرجع الأشعار — a scanned PDF the owner uploads from /jawad-ai/admin/khateeb, read page
-- by page (the text of each page with its page number), and searched when the Sheikh needs lines for a sermon.
--
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run again.

create table if not exists public.khateeb_refs (
  id uuid primary key default gen_random_uuid(),
  title text not null default '' check (char_length(title) <= 200),
  path text not null default '',
  pages integer not null default 0,
  done integer not null default 0,
  status text not null default 'uploading' check (status in ('uploading', 'reading', 'ready', 'failed')),
  error text not null default '',
  usd numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.khateeb_ref_pages (
  ref_id uuid not null references public.khateeb_refs (id) on delete cascade,
  page integer not null,
  -- the number printed on the page ('' when none could be read)
  label text not null default '',
  text text not null default '',
  -- the same text without marks and alef spellings, for searching
  norm text not null default '',
  primary key (ref_id, page)
);

alter table public.khateeb_refs enable row level security;
alter table public.khateeb_ref_pages enable row level security;
revoke all on public.khateeb_refs, public.khateeb_ref_pages from anon, authenticated;
