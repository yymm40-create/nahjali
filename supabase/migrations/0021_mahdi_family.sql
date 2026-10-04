-- «لأجل المهدي» · family: a parent adds family members (a son, a daughter…). Each member is a full account of its
-- own (projects, scores, comparisons, posts) without an e-mail; the parent enters it from «عائلتي», and going back to
-- the parent (or to a brother or sister) asks for the parent's PIN, so a child cannot open the parent's account.
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run (after 0020). Safe to run again.

create table if not exists public.mahdi_family (
  member_id uuid primary key references auth.users (id) on delete cascade,  -- a member belongs to one family
  parent_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (member_id <> parent_id)
);
create index if not exists mahdi_family_parent_idx on public.mahdi_family (parent_id, created_at);

alter table public.mahdi_family enable row level security;
drop policy if exists "mahdi family: my own family" on public.mahdi_family;
create policy "mahdi family: my own family" on public.mahdi_family
  for select to authenticated using (parent_id = (select auth.uid()) or member_id = (select auth.uid()));
revoke all on public.mahdi_family from anon, authenticated;
grant select on public.mahdi_family to authenticated;

-- The parent's PIN (a salted hash) and the guard against guessing it. Server only.
create table if not exists public.mahdi_family_settings (
  parent_id uuid primary key references auth.users (id) on delete cascade,
  pin_hash text not null check (char_length(pin_hash) <= 300),
  failed integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.mahdi_family_settings enable row level security;
revoke all on public.mahdi_family_settings from anon, authenticated;
