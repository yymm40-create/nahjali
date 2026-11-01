-- «لأجل المهدي»: notifications that bring people back (آية ورواية الصباح، ملاحظة اليوم والأسبوع، سلسلتك في خطر، اشتقنالك).
--
-- · `engage` on the notification settings keeps what the person switched OFF (every kind is on until then): {"morning": false, …}
-- · `mahdi_push_log` is the dispatcher's own memory: one row per person, kind and day, so a kind is never sent twice in a day and
--   no more than two of these reach a person in a day. Server only (no policy for the app's users).
-- · `mahdi_dispatch_runs` is the heartbeat: each run of the 15-minute dispatcher writes a row, so the app can say when it last ran.
-- Safe to run twice.

alter table public.mahdi_notification_settings
  add column if not exists engage jsonb not null default '{}'::jsonb;
do $$ begin
  alter table public.mahdi_notification_settings add constraint mahdi_notification_settings_engage_check
    check (jsonb_typeof(engage) = 'object' and pg_column_size(engage) <= 1000);
exception when duplicate_object then null; end $$;

create table if not exists public.mahdi_push_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (char_length(kind) between 1 and 30),
  day date not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, day)
);
create index if not exists mahdi_push_log_day_idx on public.mahdi_push_log (day);
alter table public.mahdi_push_log enable row level security;
revoke all on public.mahdi_push_log from anon, authenticated;

create table if not exists public.mahdi_dispatch_runs (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  checked integer not null default 0,
  sent integer not null default 0,
  engage_sent integer not null default 0
);
create index if not exists mahdi_dispatch_runs_at_idx on public.mahdi_dispatch_runs (ran_at desc);
alter table public.mahdi_dispatch_runs enable row level security;
revoke all on public.mahdi_dispatch_runs from anon, authenticated;

notify pgrst, 'reload schema';
