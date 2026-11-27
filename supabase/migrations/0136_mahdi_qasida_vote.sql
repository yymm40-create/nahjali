-- «لأجل المهدي» · «تصويت محبوبة الباري» (unlisted page /mahdi/vote): visitors without an account vote for the best solo
-- performance in the qasida «محبوبة الباري». Each row is one vote: the name the visitor wrote, the performer chosen (an id
-- from config/mahdi-vote.ts), the optional «ليش؟», and «أنا رادود» (a radood's vote counts 2 points, the public's 1).
-- The sender's address is never kept: only a salted one-way hash, for the light hourly limit and the same-name check.
-- Before this runs the page shows and refuses to keep a vote (it says try later); the results page shows nothing.
-- Run in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run twice.

create table if not exists public.mahdi_qasida_votes (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 40),
  name_key text not null check (char_length(name_key) between 1 and 40),
  performer text not null check (char_length(performer) between 1 and 40),
  reason text not null default '' check (char_length(reason) <= 500),
  radood boolean not null default false,
  ip_hash text not null check (char_length(ip_hash) <= 64),
  created_at timestamptz not null default now()
);

create index if not exists mahdi_qasida_votes_ip_idx on public.mahdi_qasida_votes (ip_hash, created_at desc);
create index if not exists mahdi_qasida_votes_name_idx on public.mahdi_qasida_votes (name_key, ip_hash);
create index if not exists mahdi_qasida_votes_created_idx on public.mahdi_qasida_votes (created_at desc);

-- read and written only by the site's server (service role): RLS on with no policies, so no visitor's key reads or writes here
alter table public.mahdi_qasida_votes enable row level security;
revoke all on public.mahdi_qasida_votes from anon, authenticated;

comment on table public.mahdi_qasida_votes is
  '«تصويت محبوبة الباري»: one vote per row (name, performer id, optional reason, radood = 2 points); address kept only as a salted hash';

notify pgrst, 'reload schema';
