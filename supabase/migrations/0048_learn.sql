-- «مكان الدورات»: courses › days › videos, watched but never downloaded.
-- The video itself is NOT here: the owner's browser cuts it into pieces, locks each with a key kept in `learn_lessons.content_key`, and uploads
-- them to a private bucket. This file only holds the structure, who may watch, and the log of viewings.
-- Server-only (RLS on, nothing granted to the browser roles): the site's API reads and writes it. Safe to run more than once.

create table if not exists public.learn_courses (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  summary text not null default '' check (char_length(summary) <= 600),
  -- buying any of these products opens the course: {live, recorded, combo}; empty = only people the owner adds by email
  unlock text[] not null default '{}',
  published boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists learn_courses_pos_idx on public.learn_courses (position, created_at);

create table if not exists public.learn_days (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.learn_courses (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists learn_days_course_idx on public.learn_days (course_id, position);

create table if not exists public.learn_lessons (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.learn_days (id) on delete cascade,
  course_id uuid not null references public.learn_courses (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  position integer not null default 0,
  -- draft: the pieces are still being uploaded · ready: all pieces are in the bucket
  status text not null default 'draft' check (status in ('draft', 'ready')),
  duration_s real not null default 0,
  mime text not null default '',
  init_bytes integer not null default 0,
  -- [{n, start, dur, bytes}, …] (the pieces, in order)
  segments jsonb not null default '[]'::jsonb,
  -- the key that locks this lesson's pieces (base64). Never sent to a viewer.
  content_key text not null,
  created_at timestamptz not null default now()
);
create index if not exists learn_lessons_day_idx on public.learn_lessons (day_id, position);
create index if not exists learn_lessons_course_idx on public.learn_lessons (course_id);

-- people the owner lets in by email (besides the buyers of the linked products)
create table if not exists public.learn_grants (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.learn_courses (id) on delete cascade,
  email text not null check (char_length(email) between 3 and 200),
  granted_by text not null default '',
  created_at timestamptz not null default now(),
  unique (course_id, email)
);

-- one row per viewing: its own key (so a recording of the network is useless to anybody else), how much it was served, and whether it was closed
create table if not exists public.learn_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null default '',
  lesson_id uuid not null references public.learn_lessons (id) on delete cascade,
  key text not null,
  ip text not null default '',
  ua text not null default '',
  started_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  served_s real not null default 0,
  pieces integer not null default 0,
  revoked boolean not null default false,
  revoked_reason text not null default ''
);
create index if not exists learn_sessions_user_idx on public.learn_sessions (user_id, last_seen desc);
create index if not exists learn_sessions_lesson_idx on public.learn_sessions (lesson_id, started_at desc);

-- things worth the owner's eye: a name tag removed, a viewing refused for speed, too many viewings
create table if not exists public.learn_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text not null default '',
  lesson_id uuid references public.learn_lessons (id) on delete cascade,
  session_id uuid,
  kind text not null,
  detail text not null default '' check (char_length(detail) <= 400),
  created_at timestamptz not null default now()
);
create index if not exists learn_flags_time_idx on public.learn_flags (created_at desc);

do $$
declare t text;
begin
  foreach t in array array['learn_courses', 'learn_days', 'learn_lessons', 'learn_grants', 'learn_sessions', 'learn_flags'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
