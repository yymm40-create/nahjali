-- «الأكواد»: many secret codes, each with its own sections and its own time, standing alone (no overlap).
-- A code opens ONLY the sections the owner ticked for it. It can stop at a fixed moment (expires_at), or give each
-- person a number of hours from when THEY enter it (valid_hours), or be limited to some people (max_uses), or be
-- switched off — any of these closes only that code's sections, never another code's, never what the email list
-- («السماح») gives. The old single «الكود السري» stays as it is (everything except the named-only sections).

create table if not exists public.site_codes (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(label) between 1 and 80),
  code text not null unique check (char_length(code) between 4 and 64),
  perms text[] not null default '{}',
  expires_at timestamptz,
  valid_hours integer check (valid_hours is null or valid_hours between 1 and 8760),
  max_uses integer check (max_uses is null or max_uses between 1 and 10000),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.site_codes enable row level security;
revoke all on public.site_codes from anon, authenticated;

-- who entered which code, and when (the moment valid_hours counts from; entering again never renews it)
create table if not exists public.site_code_uses (
  code_id uuid not null references public.site_codes (id) on delete cascade,
  email text not null check (email = lower(email)),
  at timestamptz not null default now(),
  primary key (code_id, email)
);
create index if not exists site_code_uses_email_idx on public.site_code_uses (email);
alter table public.site_code_uses enable row level security;
revoke all on public.site_code_uses from anon, authenticated;
