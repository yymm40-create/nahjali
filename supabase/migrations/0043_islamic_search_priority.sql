-- «الذكاء الإسلامي»: الروايات أولًا. البحث السابق كان يأخذ أول ٤٠٠٠ مقطع مطابق بلا ترتيب، والروايات (الثقلين) تُقرأ
-- آخر شي فأرقامها متأخرة فلا تدخل أبدًا حين تطابق الكلمات مقاطع كثيرة. الآن يقدر البحث أن يُقصَر على أنواع محددة
-- من الوثائق (kinds)، فيبحث في الروايات والأدعية لحالها أولًا ثم في الباقي. آمن لو شُغّل مرة ثانية.

create index if not exists islamic_docs_kind_idx on public.islamic_docs (kind);

drop function if exists public.islamic_search(text, integer);

create or replace function public.islamic_search(q text, k integer default 12, kinds text[] default null)
returns table (chunk_id bigint, doc_id uuid, n integer, url text, title text, kind text, source_name text, text text, rank real)
language sql stable
set statement_timeout = '25s'
as $$
  with query as (select to_tsquery('simple', q) as tq),
  hits as (
    select c.id, c.doc_id, c.n, c.text, c.tsv
    from public.islamic_chunks c
    join public.islamic_docs dd on dd.id = c.doc_id
    cross join query
    where c.tsv @@ query.tq and (kinds is null or dd.kind = any(kinds))
    limit 6000
  )
  select h.id, d.id, h.n, d.url, d.title, d.kind, s.name, h.text,
         ts_rank_cd(h.tsv, query.tq, 32) as rank
  from hits h
  cross join query
  join public.islamic_docs d on d.id = h.doc_id
  join public.islamic_sources s on s.id = d.source_id
  where s.enabled
  order by rank desc, h.id
  limit greatest(1, least(k, 60));
$$;

revoke all on function public.islamic_search(text, integer, text[]) from anon, authenticated;
