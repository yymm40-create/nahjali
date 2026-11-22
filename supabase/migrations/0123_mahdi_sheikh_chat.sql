-- «لأجل المهدي» · «الشيخ الذكي» as a chat (the owner, 22 November 2026): the floating robot opens a conversation with
-- the sheikh, who answers from our own library (مكتبة الثقلين read into islamic_docs / islamic_chunks, see 0037) with
-- a light model — no Claude agent, so a question costs a fraction of a cent. The conversation is kept.
--   · mahdi_sheikh_messages — one row per message: the person's question or the sheikh's answer (with its sources and
--     its cost), and the person's «في خطأ؟» note on an answer. Closed to clients; the server reads and writes it.
-- It replaces 0122 (questions to the Claude agent), which is dropped here if it was run.
-- Run in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run twice.

drop table if exists public.mahdi_sheikh_questions;

create table if not exists public.mahdi_sheikh_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'sheikh')),
  body text not null check (char_length(body) between 1 and 30000),
  sources jsonb not null default '[]'::jsonb,
  usd numeric(10, 6) not null default 0,
  report text,
  reported_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists mahdi_sheikh_messages_user_idx on public.mahdi_sheikh_messages (user_id, created_at desc);
create index if not exists mahdi_sheikh_messages_reported_idx on public.mahdi_sheikh_messages (reported_at desc) where reported_at is not null;

alter table public.mahdi_sheikh_messages enable row level security;
revoke all on public.mahdi_sheikh_messages from anon, authenticated;
