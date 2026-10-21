-- «صافي الربح» (/admin/profit): what every operation really cost the site (the provider's price: Claude, OpenAI,
-- Seedance, ElevenLabs…), written at the moment it is charged — for everyone, the owners' own use and free accounts
-- included — so the owner sees money in (top-ups and courses) minus what the use cost = the net profit.
-- One row per operation (`ref`: the job, the robot's reply, the editor's tool). Written by the server only.
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run more than once.

create table if not exists public.site_costs (
  ref text primary key check (char_length(ref) between 1 and 200),
  user_id uuid references auth.users (id) on delete set null,
  label text not null default '' check (char_length(label) <= 200),
  -- what the providers charged us, in halalas (decimals kept: a short reply costs a fraction of a halala)
  cost_halalas numeric(14, 4) not null default 0 check (cost_halalas >= 0),
  created_at timestamptz not null default now()
);
create index if not exists site_costs_created_idx on public.site_costs (created_at desc);
create index if not exists site_costs_user_idx on public.site_costs (user_id, created_at desc);

alter table public.site_costs enable row level security;
revoke all on public.site_costs from anon, authenticated;
