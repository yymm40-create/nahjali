-- «ترتيب أعمالي» in «الاستوديو الإبداعي»: the person's folders, and which folder each work sits in (one at most) and
-- whether it is a favourite (⭐). A work is a studio job (jawad_jobs) or a picture/video of a film project (film_assets).
-- Run in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run again.
-- Until it runs, «أعمالي» still searches and sorts; folders and favourites stay hidden with a one-line note.
-- Each person reads only their own rows; every write goes through the server (src/lib/jawad/server/works-organise.ts),
-- which checks that the work and the folder are theirs.

create table if not exists public.jawad_work_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- one name once per person (whatever the letter case)
create unique index if not exists jawad_work_folders_name_idx on public.jawad_work_folders (user_id, lower(btrim(name)));
create index if not exists jawad_work_folders_user_idx on public.jawad_work_folders (user_id, created_at);

create table if not exists public.jawad_work_marks (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_type text not null check (item_type in ('job', 'film')),
  item_id uuid not null,
  -- deleting a folder lets its works go back to «بدون مجلد» (they are never deleted with it)
  folder_id uuid references public.jawad_work_folders (id) on delete set null,
  favourite boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, item_type, item_id)
);
create index if not exists jawad_work_marks_folder_idx on public.jawad_work_marks (user_id, folder_id) where folder_id is not null;
create index if not exists jawad_work_marks_fav_idx on public.jawad_work_marks (user_id) where favourite;

alter table public.jawad_work_folders enable row level security;
alter table public.jawad_work_marks enable row level security;
revoke all on public.jawad_work_folders, public.jawad_work_marks from anon, authenticated;

drop policy if exists "jawad work folders: read own" on public.jawad_work_folders;
create policy "jawad work folders: read own" on public.jawad_work_folders for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "jawad work marks: read own" on public.jawad_work_marks;
create policy "jawad work marks: read own" on public.jawad_work_marks for select to authenticated using (user_id = (select auth.uid()));
grant select on public.jawad_work_folders, public.jawad_work_marks to authenticated;
-- inserts, updates and deletes: no policy → server only

-- One page of a person's marked works (a folder's works and/or the favourites), newest or oldest first, of one kind or
-- all, after a cursor (the created_at of the last work of the previous page). The film part keeps the same rules as the
-- works list (pictures and videos made or approved, with a file). Server only.
create or replace function public.jawad_marked_works(
  p_user uuid,
  p_folder uuid,
  p_favourite boolean,
  p_kind text,
  p_after timestamptz,
  p_oldest boolean,
  p_limit integer
)
returns table (item_type text, item_id uuid, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select w.item_type, w.item_id, w.created_at
    from (
      select 'job'::text as item_type, j.id as item_id, j.created_at
        from jawad_work_marks m
        join jawad_jobs j on j.id = m.item_id and j.user_id = p_user
       where m.user_id = p_user and m.item_type = 'job'
         and (p_folder is null or m.folder_id = p_folder)
         and (not coalesce(p_favourite, false) or m.favourite)
         and (p_kind is null or j.output_kind = p_kind)
      union all
      select 'film'::text, f.id, f.created_at
        from jawad_work_marks m
        join film_assets f on f.id = m.item_id
        join film_projects p on p.id = f.project_id and p.user_id = p_user
       where m.user_id = p_user and m.item_type = 'film'
         and (p_folder is null or m.folder_id = p_folder)
         and (not coalesce(p_favourite, false) or m.favourite)
         and f.kind in ('image', 'video') and (p_kind is null or f.kind = p_kind)
         and f.status in ('generated', 'approved') and f.storage_path is not null
    ) w
   where p_after is null or (case when coalesce(p_oldest, false) then w.created_at > p_after else w.created_at < p_after end)
   order by case when coalesce(p_oldest, false) then w.created_at end asc,
            case when not coalesce(p_oldest, false) then w.created_at end desc
   limit least(greatest(coalesce(p_limit, 25), 1), 101);
$$;
revoke all on function public.jawad_marked_works(uuid, uuid, boolean, text, timestamptz, boolean, integer) from public, anon, authenticated;
grant execute on function public.jawad_marked_works(uuid, uuid, boolean, text, timestamptz, boolean, integer) to service_role;
