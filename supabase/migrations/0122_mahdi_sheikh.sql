-- «لأجل المهدي» · «اسأل الشيخ» (the owner, 22 November 2026): questions to «الشيخ الذكي», the Claude Managed Agent that
-- searches the narration books of مكتبة الثقلين (thaqalayn.com) and answers with the texts, their sources and the grading
-- of their chains. Two kinds: «سؤال سريع» (a short answer) and «بحث شامل» (the whole chapter and a Word file).
--   · mahdi_sheikh_questions — one row per question: the agent's session, its state, the answer, its files, its cost,
--     and the person's «في خطأ؟» report. Closed to clients; the server reads and writes it.
-- Run in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run twice.

create table if not exists public.mahdi_sheikh_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null check (mode in ('quick', 'deep')),
  question text not null check (char_length(btrim(question)) between 3 and 1000),
  session_id text,
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  answer text,
  files jsonb not null default '[]'::jsonb,
  error text,
  cost_cents integer,
  report text,
  reported_at timestamptz,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists mahdi_sheikh_questions_user_idx on public.mahdi_sheikh_questions (user_id, created_at desc);
create index if not exists mahdi_sheikh_questions_reported_idx on public.mahdi_sheikh_questions (reported_at desc) where reported_at is not null;

alter table public.mahdi_sheikh_questions enable row level security;
revoke all on public.mahdi_sheikh_questions from anon, authenticated;
