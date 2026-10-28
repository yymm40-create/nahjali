-- Every robot's conversation handoff (the owner, 28 October 2026): when a conversation grows past what a robot reads
-- in one go, it writes itself a handoff of everything before (the goal, the decisions, what was done, what is left)
-- and reads it first, then the latest messages — so nothing is forgotten. The conversation itself stays whole in its
-- own table. Written by the server only (service role). Safe to run twice.

create table if not exists public.robot_handoffs (
  key text primary key check (char_length(key) between 3 and 200),
  user_id uuid references auth.users (id) on delete cascade,
  up_to integer not null default 0 check (up_to >= 0),
  text text not null default '' check (char_length(text) <= 20000),
  updated_at timestamptz not null default now()
);
create index if not exists robot_handoffs_user_idx on public.robot_handoffs (user_id);

alter table public.robot_handoffs enable row level security;
revoke all on public.robot_handoffs from anon, authenticated;
