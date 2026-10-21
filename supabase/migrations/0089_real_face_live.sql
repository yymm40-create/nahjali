-- «Seedance وجه واقعي» goes live for everyone (the owner's order, 21 October 2026): shown in «صناعة الفيديو».
-- The film maker offers it too, for realistic scenes, marked as much dearer than the others.
insert into public.jawad_generators (id, section_id, enabled)
values ('seedance-real-face', 'video', true)
on conflict (id) do update set enabled = true, updated_at = now();
