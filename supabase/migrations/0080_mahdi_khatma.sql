-- «لأجل المهدي» · «الختمة العلوية»: a group shares out the whole Quran every week (or every few weeks). The leader picks
-- how it is cut (30 juz, 60 hizb, 120 half hizb or 240 quarter hizb), the night it ends, and for how many khatmas a
-- reader may not take again what they already read. Members take free portions themselves; one portion has one reader.
-- Private groups only for now. Server-only, like the rest of the group data.
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run again.

create table if not exists public.mahdi_khatma_settings (
  group_id uuid primary key references public.mahdi_groups (id) on delete cascade,
  division text not null default 'hizb' check (division in ('juz', 'hizb', 'half', 'quarter')),
  weeks smallint not null default 1 check (weeks between 1 and 4),
  end_dow smallint not null default 4 check (end_dow between 0 and 6),
  end_hour smallint not null default 21 check (end_hour between 0 and 23),
  time_zone text not null default 'Asia/Riyadh',
  no_repeat smallint not null default 3 check (no_repeat between 0 and 20),
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists mahdi_khatma_settings_touch_updated_at on public.mahdi_khatma_settings;
create trigger mahdi_khatma_settings_touch_updated_at
  before update on public.mahdi_khatma_settings
  for each row execute function public.touch_updated_at();

-- One row per khatma (round). «done» = every portion read; «closed» = the leader ended it at its deadline.
create table if not exists public.mahdi_khatmas (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.mahdi_groups (id) on delete cascade,
  number integer not null check (number >= 1),
  division text not null check (division in ('juz', 'hizb', 'half', 'quarter')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'done', 'closed')),
  finished_at timestamptz,
  dedicated_to text not null default '' check (char_length(dedicated_to) <= 120),
  for_soul_of text not null default '' check (char_length(for_soul_of) <= 120),
  created_at timestamptz not null default now(),
  unique (group_id, number),
  unique (id, group_id)
);
create index if not exists mahdi_khatmas_group_idx on public.mahdi_khatmas (group_id, number desc);

-- Who reads which portion. The primary key makes a portion one reader's: two taps at once, one wins.
-- from_q/to_q (the hizb quarters it covers) compare portions across khatmas cut differently.
create table if not exists public.mahdi_khatma_claims (
  khatma_id uuid not null,
  group_id uuid not null,
  portion smallint not null check (portion between 1 and 240),
  from_q smallint not null check (from_q between 1 and 240),
  to_q smallint not null check (to_q between from_q and 240),
  user_id uuid references auth.users (id) on delete set null,
  status text not null default 'reading' check (status in ('reading', 'done')),
  claimed_at timestamptz not null default now(),
  done_at timestamptz,
  primary key (khatma_id, portion),
  foreign key (khatma_id, group_id) references public.mahdi_khatmas (id, group_id) on delete cascade
);
create index if not exists mahdi_khatma_claims_reader_idx on public.mahdi_khatma_claims (group_id, user_id, status);

alter table public.mahdi_khatma_settings enable row level security;
alter table public.mahdi_khatmas enable row level security;
alter table public.mahdi_khatma_claims enable row level security;

-- No direct policies: reads and writes go through the server after checking active membership and leadership.
revoke all on public.mahdi_khatma_settings, public.mahdi_khatmas, public.mahdi_khatma_claims from anon, authenticated;
