-- «الجواد الذكي!» | JAWAD AI · «صانع الألعاب الذكي»: a player's progress in a game, kept on their site account.
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run again.
create table if not exists public.game_saves (
  user_id uuid not null references auth.users (id) on delete cascade,
  game_id uuid not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id)
);
alter table public.game_saves enable row level security;
revoke all on public.game_saves from anon, authenticated;
