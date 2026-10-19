-- «الجواد الذكي!» | JAWAD AI · «صانع الألعاب الذكي»: who opened a game and how long they played (the game's counter).
-- One row per sitting: a browser (its own random id, signed in or not), where it came from, and the seconds it was
-- played (counted while the game is on screen). The game's owner and the site's owner see the numbers.
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run again.
create table if not exists public.game_plays (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games_builds (id) on delete cascade,
  visitor text not null check (char_length(visitor) between 8 and 64),
  user_id uuid references auth.users (id) on delete set null,
  source text not null default '' check (char_length(source) <= 40),
  device text not null default '' check (device in ('', 'phone', 'tablet', 'desktop')),
  seconds integer not null default 0 check (seconds >= 0),
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists game_plays_game_idx on public.game_plays (game_id, started_at desc);
create index if not exists game_plays_visitor_idx on public.game_plays (game_id, visitor, last_seen_at desc);
alter table public.game_plays enable row level security;
revoke all on public.game_plays from anon, authenticated;
