-- «لأجل المهدي»: the notifications inbox (the bell in the top bar) and «المساعد» (questions answered by the owner,
-- no automatic replies).
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run (after 0017).
--
-- `mahdi_inbox`: one row per notification. Only the server writes them; each user reads, marks as read and deletes
-- their own.
-- `mahdi_assistant_messages`: one conversation per user. The user writes their questions (RLS); the owner's answers
-- are written by the server after checking the owner.

-- ───────────────────────── notifications inbox ─────────────────────────
create table if not exists public.mahdi_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind ~ '^[a-z_]{1,30}$'),  -- assistant_reply, assistant_message, …
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 400),
  url text not null default '' check (char_length(url) <= 300 and (url = '' or url like '/%')),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists mahdi_inbox_user_idx on public.mahdi_inbox (user_id, created_at desc);
create index if not exists mahdi_inbox_unread_idx on public.mahdi_inbox (user_id) where read_at is null;

alter table public.mahdi_inbox enable row level security;
drop policy if exists "mahdi inbox: read own" on public.mahdi_inbox;
create policy "mahdi inbox: read own" on public.mahdi_inbox
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "mahdi inbox: mark own as read" on public.mahdi_inbox;
create policy "mahdi inbox: mark own as read" on public.mahdi_inbox
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "mahdi inbox: delete own" on public.mahdi_inbox;
create policy "mahdi inbox: delete own" on public.mahdi_inbox
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.mahdi_inbox from anon, authenticated;
grant select, delete on public.mahdi_inbox to authenticated;
grant update (read_at) on public.mahdi_inbox to authenticated;

-- ───────────────────────── «المساعد» ─────────────────────────
create table if not exists public.mahdi_assistant_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,  -- whose conversation
  from_owner boolean not null default false,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz  -- when the other side read it
);
create index if not exists mahdi_assistant_user_idx on public.mahdi_assistant_messages (user_id, created_at);
create index if not exists mahdi_assistant_waiting_idx on public.mahdi_assistant_messages (created_at desc) where not from_owner and read_at is null;

alter table public.mahdi_assistant_messages enable row level security;
drop policy if exists "mahdi assistant: read own conversation" on public.mahdi_assistant_messages;
create policy "mahdi assistant: read own conversation" on public.mahdi_assistant_messages
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "mahdi assistant: ask" on public.mahdi_assistant_messages;
create policy "mahdi assistant: ask" on public.mahdi_assistant_messages
  for insert to authenticated with check (user_id = (select auth.uid()) and not from_owner and read_at is null);

revoke all on public.mahdi_assistant_messages from anon, authenticated;
grant select, insert on public.mahdi_assistant_messages to authenticated;

-- The owner's account ids, from their e-mails (to notify the owner of new questions). Server only.
create or replace function public.mahdi_user_ids_by_email(p_emails text[])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id from auth.users u where lower(u.email) = any (select lower(e) from unnest(p_emails) as e);
$$;
revoke all on function public.mahdi_user_ids_by_email(text[]) from public, anon, authenticated;
grant execute on function public.mahdi_user_ids_by_email(text[]) to service_role;
