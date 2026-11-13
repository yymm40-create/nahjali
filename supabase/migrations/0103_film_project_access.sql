-- «اسمح للأدمن بالدخول على مشروعك»: an admin asks to work on someone's film project; the owner sees the request and
-- allows or refuses it. Once allowed, the project opens in the admin's own film maker and every change he makes is
-- made on the owner's project itself (same project, same steps). The owner can stop it any time.
-- Safe to run twice. Before it runs, requests simply can't be made (the app treats the table as empty).

create table if not exists public.film_project_access (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.film_projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  admin_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'revoked')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index if not exists film_project_access_pair_idx on public.film_project_access (project_id, admin_id);
create index if not exists film_project_access_owner_idx on public.film_project_access (owner_id) where status = 'pending';
create index if not exists film_project_access_admin_idx on public.film_project_access (admin_id) where status = 'approved';

-- read and written only by the server (service role)
alter table public.film_project_access enable row level security;
revoke all on public.film_project_access from anon, authenticated;
