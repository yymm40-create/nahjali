-- «لأجل المهدي» · «إخوة الولاية»: «ذكّرته بلطف» (the plan «واجهة لأجل المهدي الجديدة», approved 26 November 2026).
-- A member may send another member of the same group one gentle reminder a day; it reaches them as a notification.
-- The row only says who reminded whom on which day (the sender's own day), so a second tap the same day is refused.
-- Nothing about anyone's progress is stored or shown here, so the group privacy choice of 0129 is untouched.
-- Before this runs the app keeps working: the reminder button stays hidden and the group page works as before.
-- Run in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run twice.

create table if not exists public.mahdi_group_nudges (
  group_id uuid not null references public.mahdi_groups (id) on delete cascade,
  from_id uuid not null references auth.users (id) on delete cascade,
  to_id uuid not null references auth.users (id) on delete cascade,
  nudge_date date not null,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id, nudge_date),
  constraint mahdi_group_nudges_not_self check (from_id <> to_id)
);

create index if not exists mahdi_group_nudges_to_idx on public.mahdi_group_nudges (to_id, nudge_date);
create index if not exists mahdi_group_nudges_group_idx on public.mahdi_group_nudges (group_id);

-- read and written only by the site's server (service role), like the other group tables (0010, 0073, 0083):
-- RLS on with no policies, so a person's own key reads nothing here
alter table public.mahdi_group_nudges enable row level security;
revoke all on public.mahdi_group_nudges from anon, authenticated;

comment on table public.mahdi_group_nudges is
  '«ذكّرته بلطف»: one gentle reminder a day from one group member to another (the sender''s day)';

notify pgrst, 'reload schema';
