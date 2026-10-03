-- «لأجل المهدي»: feedback from users («شاركنا رأيك»), read by the owner on /admin/mahdi.
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run (after 0012).
--
-- Each user writes and reads their own rows only (RLS); the owner reads all of them through the server.
-- `mahdi_feedback_prompt` remembers when the occasional popup was last closed, so it does not come back too soon.

create table public.mahdi_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rating smallint check (rating is null or rating between 1 and 5),
  kind text not null default 'general' check (kind in ('general', 'idea', 'problem', 'praise')),
  message text not null default '' check (char_length(message) <= 1000),
  place text not null default '' check (char_length(place) <= 30),  -- where it was sent from (more, progress, popup…)
  created_at timestamptz not null default now(),
  check (rating is not null or char_length(btrim(message)) > 0)
);
create index mahdi_feedback_created_idx on public.mahdi_feedback (created_at desc);
create index mahdi_feedback_user_idx on public.mahdi_feedback (user_id, created_at desc);

create table public.mahdi_feedback_prompt (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  dismissed_at timestamptz not null default now()
);

alter table public.mahdi_feedback enable row level security;
alter table public.mahdi_feedback_prompt enable row level security;

create policy "mahdi feedback: add own" on public.mahdi_feedback
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "mahdi feedback: read own" on public.mahdi_feedback
  for select to authenticated using (user_id = (select auth.uid()));
create policy "mahdi feedback prompt: own row" on public.mahdi_feedback_prompt
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.mahdi_feedback, public.mahdi_feedback_prompt from anon;
grant select, insert on public.mahdi_feedback to authenticated;
grant select, insert, update, delete on public.mahdi_feedback_prompt to authenticated;
