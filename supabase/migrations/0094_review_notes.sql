-- «لأجل المهدي» · «حاسبوا أنفسكم»: a note the person writes for the daily, weekly and monthly review.
-- One note per person per period: a day (its date), a week (its first day), a month (its first day). Private: the
-- person reads and writes only their own, through their own session. Safe to run twice.

create table if not exists public.mahdi_review_notes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('day', 'week', 'month')),
  period_start date not null,
  note text not null default '' check (char_length(note) <= 2000),
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, period_start)
);

alter table public.mahdi_review_notes enable row level security;

do $$ begin
  create policy mahdi_review_notes_own on public.mahdi_review_notes
    for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

grant select, insert, update, delete on public.mahdi_review_notes to authenticated;
