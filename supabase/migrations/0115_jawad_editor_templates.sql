-- «حيدرة كت»: «قوالب المونتاج» — the person's own templates («احفظ كقالب»). Run once in Supabase: Dashboard → SQL Editor →
-- paste → Run. Safe to run again. Before it runs the ready templates still work (they live in the site's code) and
-- «احفظ كقالب» says this file is needed. Our server routes write through the service role after a sign-in check; a person
-- may read their own rows directly (RLS), nothing else — the same rule as editor_projects (0030).

create table if not exists public.editor_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 40),
  -- 9:16 · 16:9 · 1:1 · 4:5
  ratio text not null default '9:16' check (ratio in ('9:16', '16:9', '1:1', '4:5')),
  -- the template itself (slots, texts, transitions, effects, look, beat, captions look), checked by the server before it is kept
  doc jsonb not null check (jsonb_typeof(doc) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists editor_templates_user_idx on public.editor_templates (user_id, created_at desc);

alter table public.editor_templates enable row level security;
drop policy if exists "editor templates: read own" on public.editor_templates;
create policy "editor templates: read own" on public.editor_templates for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.editor_templates from anon, authenticated;
grant select on public.editor_templates to authenticated;

notify pgrst, 'reload schema';
