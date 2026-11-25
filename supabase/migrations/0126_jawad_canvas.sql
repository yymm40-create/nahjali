-- «اللوحة» in «الاستوديو الإبداعي» (/jawad-ai/canvas): the person's node canvases and their own recipes («احفظ كوصفة»).
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run again.
-- Until it runs the page still works (build a canvas, run it, use the ready recipes); only saving, the saved list and
-- «احفظ كوصفة» stay off with a one-line note. Every generation a canvas runs is an ordinary studio job (jawad_jobs), so
-- prices, holds, refunds and «أعمالي» need nothing new here.
-- Each person reads only their own rows (RLS); every write goes through the server (src/lib/jawad/server/canvas.ts) after a
-- sign-in check and a check of the graph — the same rule as jawad_work_folders (0113).

create table if not exists public.jawad_canvases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  -- canvas: a working canvas (keeps its finished results, so a rerun pays only for what changed) · recipe: «احفظ كوصفة»
  kind text not null default 'canvas' check (kind in ('canvas', 'recipe')),
  -- the nodes, the wires and (canvas only) each node's last result; checked by the server before it is kept
  graph jsonb not null check (jsonb_typeof(graph) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists jawad_canvases_user_idx on public.jawad_canvases (user_id, kind, updated_at desc);

alter table public.jawad_canvases enable row level security;
revoke all on public.jawad_canvases from anon, authenticated;
drop policy if exists "jawad canvases: read own" on public.jawad_canvases;
create policy "jawad canvases: read own" on public.jawad_canvases for select to authenticated using (user_id = (select auth.uid()));
grant select on public.jawad_canvases to authenticated;
-- inserts, updates and deletes: no policy → server only

notify pgrst, 'reload schema';
