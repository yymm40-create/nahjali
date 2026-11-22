-- «لأجل المهدي» · «رابط حسابي»: show my reading on the link I put in Instagram (the owner, 22 November 2026).
-- Off by default. When on, the public page of the link (/mahdi/join/<username>) and my page in the app show what I
-- read (pages this month, all the pages, books finished, what I'm reading now) and my place in «تحدي القراءة».
-- Run in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run twice.
alter table public.mahdi_privacy add column if not exists share_reading boolean not null default false;
