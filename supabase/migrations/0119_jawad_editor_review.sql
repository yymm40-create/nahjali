-- «حيدرة كت»: «رابط مراجعة للعميل» — a review link of a project (like Frame.io), its versions («نسخة ٢» on the same link)
-- and the client's time-stamped comments. Run once in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run again.
-- Before it runs, «شارك للمراجعة» says this file is needed and nothing else changes. Our server routes read and write
-- through the service role after a check (the project's owner manages; the public page may only comment on an active
-- link); a person may read their own rows directly (RLS), nobody else — the same rule as editor_projects (0030).
-- The videos themselves are the owner's checked uploads (jawad_uploads, the JAWAD bucket, 200 MB each, MP4/MOV): the
-- newest 5 versions of a link keep theirs, and the daily clean-up deletes them 30 days after a link's expiry.

create table if not exists public.editor_reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.editor_projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- the unguessable part of the link (/jawad-ai/review/<slug>)
  slug text not null check (slug ~ '^[A-Za-z0-9]{20,40}$'),
  title text not null default '' check (char_length(title) <= 120),
  -- «شغّال» / «موقّف»; «يقدر ينزّل»; the optional end
  active boolean not null default true,
  allow_download boolean not null default false,
  expires_at timestamptz,
  -- the owner's last look at the comments (the editor's «جديد» badge counts the client's comments after it)
  seen_at timestamptz not null default now(),
  -- when the clean-up deleted the videos of an expired link
  videos_purged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists editor_reviews_project_idx on public.editor_reviews (project_id);
create unique index if not exists editor_reviews_slug_idx on public.editor_reviews (slug);
create index if not exists editor_reviews_expiry_idx on public.editor_reviews (expires_at) where expires_at is not null and videos_purged_at is null;

create table if not exists public.editor_review_versions (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.editor_reviews (id) on delete cascade,
  n integer not null check (n between 1 and 999),
  upload_id uuid references public.jawad_uploads (id) on delete set null,
  -- the video in the JAWAD bucket (null once deleted: the comments stay)
  storage_path text check (storage_path is null or char_length(storage_path) <= 400),
  duration_ms integer not null default 0 check (duration_ms >= 0),
  width integer,
  height integer,
  -- the project's saved version when it was shared, and its clips then (to carry a comment's time to the project now)
  project_version integer,
  anchors jsonb not null default '[]' check (jsonb_typeof(anchors) = 'array'),
  created_at timestamptz not null default now()
);
create unique index if not exists editor_review_versions_n_idx on public.editor_review_versions (review_id, n);

create table if not exists public.editor_review_comments (
  id bigint generated always as identity primary key,
  review_id uuid not null references public.editor_reviews (id) on delete cascade,
  version_id uuid not null references public.editor_review_versions (id) on delete cascade,
  -- a reply (one level)
  parent_id bigint references public.editor_review_comments (id) on delete cascade,
  -- a comment, or «موافق» on the whole version
  kind text not null default 'comment' check (kind in ('comment', 'approve')),
  author text not null check (char_length(author) between 1 and 40),
  by_owner boolean not null default false,
  -- always shown as plain text (cleaned by the server: no links, no HTML)
  body text not null default '' check (char_length(body) <= 1000),
  at_ms integer check (at_ms is null or at_ms >= 0),
  shape jsonb check (shape is null or jsonb_typeof(shape) = 'object'),
  resolved_at timestamptz,
  -- a one-way hash of the sender's address (the hourly limit), never the address itself
  ip_hash text check (ip_hash is null or char_length(ip_hash) <= 64),
  created_at timestamptz not null default now()
);
create index if not exists editor_review_comments_review_idx on public.editor_review_comments (review_id, created_at);
create index if not exists editor_review_comments_version_idx on public.editor_review_comments (version_id, created_at);
create index if not exists editor_review_comments_ip_idx on public.editor_review_comments (review_id, ip_hash, created_at);

alter table public.editor_reviews enable row level security;
alter table public.editor_review_versions enable row level security;
alter table public.editor_review_comments enable row level security;
drop policy if exists "editor reviews: read own" on public.editor_reviews;
create policy "editor reviews: read own" on public.editor_reviews for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "editor review versions: read own" on public.editor_review_versions;
create policy "editor review versions: read own" on public.editor_review_versions for select to authenticated
  using (exists (select 1 from public.editor_reviews r where r.id = review_id and r.user_id = (select auth.uid())));
drop policy if exists "editor review comments: read own" on public.editor_review_comments;
create policy "editor review comments: read own" on public.editor_review_comments for select to authenticated
  using (exists (select 1 from public.editor_reviews r where r.id = review_id and r.user_id = (select auth.uid())));
revoke all on public.editor_reviews, public.editor_review_versions, public.editor_review_comments from anon, authenticated;
grant select on public.editor_reviews, public.editor_review_versions, public.editor_review_comments to authenticated;

notify pgrst, 'reload schema';
