-- «الذكاء الإسلامي»: a faster search. The first one ranked EVERY passage that matched any word of the question
-- across the whole library before keeping the best, which on a large library ran past the database's time limit
-- («canceling statement due to statement timeout»). Now: at most 4,000 candidates are taken from the index first,
-- only those are ranked, and the function may run up to 25 seconds. Safe to run again.

create or replace function public.islamic_search(q text, k integer default 12)
returns table (chunk_id bigint, doc_id uuid, n integer, url text, title text, kind text, source_name text, text text, rank real)
language sql stable
set statement_timeout = '25s'
as $$
  with query as (select to_tsquery('simple', q) as tq),
  hits as (
    select c.id, c.doc_id, c.n, c.text, c.tsv
    from public.islamic_chunks c, query
    where c.tsv @@ query.tq
    limit 4000
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

revoke all on function public.islamic_search(text, integer) from anon, authenticated;
