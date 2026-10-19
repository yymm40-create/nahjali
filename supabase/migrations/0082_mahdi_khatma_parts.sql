-- «لأجل المهدي» · «الختمة العلوية»: not only the whole Quran. A khatma (a group's, or a person's own «ختمتي») may cover a
-- stretch of it (e.g. juz 1–5, pages 1–100), cut in PAGES too (the 604 pages of the Madinah mushaf) besides juz, hizb,
-- half and quarter hizb. range_from/range_to are portion numbers in the khatma's division; both empty = the whole Quran.
-- Group claims also keep the verses they cover (from_v/to_v, 1–6236) so portions cut differently (a page and a hizb)
-- are compared exactly when a reader may not take again what they read.
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run (after 0080 and 0081). Safe to run again.

-- the group khatma (0080)
alter table public.mahdi_khatma_settings drop constraint if exists mahdi_khatma_settings_division_check;
alter table public.mahdi_khatma_settings add constraint mahdi_khatma_settings_division_check check (division in ('page', 'juz', 'hizb', 'half', 'quarter'));
alter table public.mahdi_khatma_settings add column if not exists range_from smallint, add column if not exists range_to smallint;
alter table public.mahdi_khatma_settings drop constraint if exists mahdi_khatma_settings_range_check;
alter table public.mahdi_khatma_settings add constraint mahdi_khatma_settings_range_check
  check ((range_from is null and range_to is null) or (range_from >= 1 and range_to >= range_from and range_to <= 604));

alter table public.mahdi_khatmas drop constraint if exists mahdi_khatmas_division_check;
alter table public.mahdi_khatmas add constraint mahdi_khatmas_division_check check (division in ('page', 'juz', 'hizb', 'half', 'quarter'));
alter table public.mahdi_khatmas add column if not exists range_from smallint, add column if not exists range_to smallint;
alter table public.mahdi_khatmas drop constraint if exists mahdi_khatmas_range_check;
alter table public.mahdi_khatmas add constraint mahdi_khatmas_range_check
  check ((range_from is null and range_to is null) or (range_from >= 1 and range_to >= range_from and range_to <= 604));

alter table public.mahdi_khatma_claims drop constraint if exists mahdi_khatma_claims_portion_check;
alter table public.mahdi_khatma_claims add constraint mahdi_khatma_claims_portion_check check (portion between 1 and 604);
alter table public.mahdi_khatma_claims add column if not exists from_v smallint, add column if not exists to_v smallint;
alter table public.mahdi_khatma_claims drop constraint if exists mahdi_khatma_claims_verses_check;
alter table public.mahdi_khatma_claims add constraint mahdi_khatma_claims_verses_check
  check ((from_v is null and to_v is null) or (from_v >= 1 and to_v >= from_v and to_v <= 6236));

-- «ختمتي» (0081): its own division and stretch; `quarter` in its reads is the portion number in that division
alter table public.mahdi_my_khatmas add column if not exists unit text not null default 'quarter';
alter table public.mahdi_my_khatmas drop constraint if exists mahdi_my_khatmas_unit_check;
alter table public.mahdi_my_khatmas add constraint mahdi_my_khatmas_unit_check check (unit in ('page', 'juz', 'hizb', 'half', 'quarter'));
alter table public.mahdi_my_khatmas add column if not exists range_from smallint, add column if not exists range_to smallint;
alter table public.mahdi_my_khatmas drop constraint if exists mahdi_my_khatmas_range_check;
alter table public.mahdi_my_khatmas add constraint mahdi_my_khatmas_range_check
  check ((range_from is null and range_to is null) or (range_from >= 1 and range_to >= range_from and range_to <= 604));

alter table public.mahdi_my_khatma_reads drop constraint if exists mahdi_my_khatma_reads_quarter_check;
alter table public.mahdi_my_khatma_reads add constraint mahdi_my_khatma_reads_quarter_check check (quarter between 1 and 604);
