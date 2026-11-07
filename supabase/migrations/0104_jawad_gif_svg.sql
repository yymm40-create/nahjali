-- GPT Image 2.6 in «الاستوديو الإبداعي» returns animated GIFs and SVG drawings: the private 'jawad' bucket keeps its
-- existing types and takes these two as well (results only; references stay PNG/JPEG/WEBP, checked by the server).
update storage.buckets
set allowed_mime_types = (
  select array_agg(distinct t)
  from unnest(coalesce(allowed_mime_types, array[]::text[]) || array['image/gif', 'image/svg+xml']) as t
)
where id = 'jawad';
