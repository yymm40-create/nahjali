-- Wan 3.0 goes live for everyone (the owner's order, 24 October 2026): shown in «صناعة الفيديو».
-- The film maker («المشهد السينمائي») offers it too, beside Seedance (much cheaper, strong animation, up to 30 s).
insert into public.jawad_generators (id, section_id, enabled)
values ('wan-3-0', 'video', true)
on conflict (id) do update set enabled = true, updated_at = now();
