-- «معرض الناس» (/jawad-ai/gallery) and the permanent share link of one work (/jawad-ai/w/<slug>) in «الاستوديو الإبداعي».
-- One row per published or shared result (a picture or a video of the person's own job): the prompt, generator,
-- settings, style and reference style copied from the job (never its reference files — only their names), the gallery
-- status the owner sets (nothing is public before he approves) and the share link the work's owner turns on or off.
-- The files themselves stay private in the «jawad» bucket: the server signs a short link to that one file on each view.
-- Run in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run again. Until it runs, the buttons and pages say so.
-- The browser reads and writes only through our server routes (service role); people may read their own rows (RLS).

create table if not exists public.jawad_gallery (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references public.jawad_jobs (id) on delete cascade,
  output_id uuid not null references public.jawad_outputs (id) on delete cascade,
  kind text not null check (kind in ('image', 'video')),
  title text not null default '' check (char_length(title) <= 80),
  prompt text not null default '' check (char_length(prompt) <= 40000),
  generator_id text not null check (char_length(generator_id) <= 120),
  settings jsonb not null default '{}',
  style_id text not null default '' check (char_length(style_id) <= 120),
  ref_style text not null default 'none' check (ref_style in ('none', 'frames', 'references')),
  -- the names the prompt gives its references ([{"name":"img1","kind":"image"}]) — never a file, an upload or a link
  ref_names jsonb not null default '[]',
  width integer,
  height integer,
  -- none: share link only · pending: waits for the owner · approved · rejected · hidden: taken down (gallery and link)
  status text not null default 'none' check (status in ('none', 'pending', 'approved', 'rejected', 'hidden')),
  featured boolean not null default false,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by text,
  share_slug text check (share_slug ~ '^[A-Za-z0-9]{8,32}$'),
  share_on boolean not null default false,
  shared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists jawad_gallery_output_idx on public.jawad_gallery (output_id);
create unique index if not exists jawad_gallery_slug_idx on public.jawad_gallery (share_slug) where share_slug is not null;
create index if not exists jawad_gallery_user_idx on public.jawad_gallery (user_id, created_at desc);
create index if not exists jawad_gallery_public_idx on public.jawad_gallery (kind, featured desc, reviewed_at desc) where status = 'approved';
create index if not exists jawad_gallery_review_idx on public.jawad_gallery (status, submitted_at desc);
drop trigger if exists jawad_gallery_touch_updated_at on public.jawad_gallery;
create trigger jawad_gallery_touch_updated_at before update on public.jawad_gallery for each row execute function public.touch_updated_at();

alter table public.jawad_gallery enable row level security;
drop policy if exists "jawad gallery: read own" on public.jawad_gallery;
create policy "jawad gallery: read own" on public.jawad_gallery for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.jawad_gallery from anon, authenticated;
grant select on public.jawad_gallery to authenticated;
