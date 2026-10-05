-- «الطالب الذكي» — for the owner's statistics page (/jawad-ai/admin/student): page visits (signed in or not) and the
-- students' feedback. Run once in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run again.
-- Written and read only through the server (service role).

create table if not exists public.student_visits (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  -- a random id kept in the visitor's browser (counts visitors who did not sign in)
  visitor text not null check (char_length(visitor) between 8 and 64),
  path text not null default '' check (char_length(path) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists student_visits_created_idx on public.student_visits (created_at desc);

create table if not exists public.student_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  project_id uuid references public.student_projects (id) on delete set null,
  stage text not null default '' check (char_length(stage) <= 40),
  rating integer check (rating between 1 and 5),
  message text not null default '' check (char_length(message) <= 3000),
  created_at timestamptz not null default now()
);
create index if not exists student_feedback_created_idx on public.student_feedback (created_at desc);

alter table public.student_visits enable row level security;
alter table public.student_feedback enable row level security;
revoke all on public.student_visits from anon, authenticated;
revoke all on public.student_feedback from anon, authenticated;

notify pgrst, 'reload schema';
