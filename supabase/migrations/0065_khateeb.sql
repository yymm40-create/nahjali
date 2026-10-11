-- «الجواد الذكي!» | JAWAD AI · «الخطيب الذكي»: a hidden branch of «الطالب الذكي» (the same tables, told apart by `branch`),
-- opened by a secret link and a password the owner sets from /jawad-ai/admin/khateeb.
--
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run again.

alter table public.student_projects add column if not exists branch text not null default 'student';
create index if not exists student_projects_branch_idx on public.student_projects (user_id, branch, last_activity_at desc);

-- the owner's settings: the link's word, the password (only its scrypt hash is kept), the method and the poems
create table if not exists public.khateeb_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.khateeb_settings enable row level security;
revoke all on public.khateeb_settings from anon, authenticated;
