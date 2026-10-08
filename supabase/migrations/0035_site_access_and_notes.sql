-- ONE place for who may use what (the dashboard's «السماح»): an email and the sections it may use, free and
-- unlimited. It replaces every other way in (section modes, per-email allow/block, film invites, trials, per-email
-- limits). «لأجل المهدي» stays open to everyone and isn't in it. The owner and co-owner are in the code.
create table if not exists public.site_access (
  email text primary key check (email = lower(email) and char_length(email) <= 254),
  perms text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.site_access enable row level security;
revoke all on public.site_access from anon, authenticated;

-- the owner's guest keeps everything
insert into public.site_access (email, perms)
values ('hassanirno44@gmail.com', array['image','video','voice','music','film','editor','editor_ai','student','booklet'])
on conflict (email) do nothing;

-- «الملاحظ حسن»: a note left on any page, at the spot it was left (for the dashboard's «الملاحظات»)
create table if not exists public.site_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text,
  name text not null check (char_length(name) between 1 and 80),
  note text not null check (char_length(note) between 1 and 4000),
  -- where: the page, the spot (in the page, and in the window), the thing that was there, the screen
  path text not null check (char_length(path) <= 1000),
  x real, y real, vx real, vy real,
  target text not null default '' check (char_length(target) <= 300),
  viewport text not null default '',
  status text not null default 'new' check (status in ('new', 'done')),
  created_at timestamptz not null default now()
);
create index if not exists site_notes_created_idx on public.site_notes (created_at desc);
alter table public.site_notes enable row level security;
revoke all on public.site_notes from anon, authenticated;

-- «الكود السري»: whoever enters it (signed in) gets everything, for as long as THIS code stays on. Changing the code
-- (a new code_id) or switching it off closes it again for all who came in by it. One row.
create table if not exists public.site_secret (
  id int primary key default 1 check (id = 1),
  code text not null default '' check (char_length(code) <= 64),
  code_id uuid not null default gen_random_uuid(),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.site_secret (id) values (1) on conflict (id) do nothing;
alter table public.site_secret enable row level security;
revoke all on public.site_secret from anon, authenticated;

create table if not exists public.site_code_grants (
  email text primary key check (email = lower(email)),
  code_id uuid not null,
  created_at timestamptz not null default now()
);
alter table public.site_code_grants enable row level security;
revoke all on public.site_code_grants from anon, authenticated;

-- wrong guesses, so the code can't be guessed (a few an hour per account)
create table if not exists public.site_code_tries (
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now()
);
create index if not exists site_code_tries_idx on public.site_code_tries (user_id, at desc);
alter table public.site_code_tries enable row level security;
revoke all on public.site_code_tries from anon, authenticated;
