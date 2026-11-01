-- «المسابقة»: each finished round keeps its result and what happened, and the race keeps a souvenir album.
-- The photos live in the race's own rows, so they go when the race is deleted. Safe to run twice.
-- Run this BEFORE the code that reads these columns goes live.

alter table public.mahdi_race_rounds add column if not exists result text not null default '';
alter table public.mahdi_race_rounds add column if not exists winner_team text;
alter table public.mahdi_race_rounds add column if not exists finished_at timestamptz;

create table if not exists public.mahdi_race_photos (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.mahdi_races (id) on delete cascade,
  round_id uuid references public.mahdi_race_rounds (id) on delete set null,
  caption text not null default '' check (char_length(caption) <= 200),
  image text not null check (char_length(image) <= 2000000),
  created_at timestamptz not null default now()
);
create index if not exists mahdi_race_photos_race_idx on public.mahdi_race_photos (race_id, created_at);

alter table public.mahdi_race_photos enable row level security;
-- No policies on purpose: only the server (service role) reaches this table.
revoke all on public.mahdi_race_photos from anon, authenticated;

notify pgrst, 'reload schema';
