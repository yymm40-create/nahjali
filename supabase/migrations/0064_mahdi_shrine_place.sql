-- «لأجل المهدي» · where the drawn holy shrine shows: as the design does (null / 'auto'), behind every page, a banner
-- on the home, a skyline under the greeting, the photo in the design's colours, or not at all.
alter table public.mahdi_profiles add column if not exists shrine_place text
  check (shrine_place is null or shrine_place in ('auto', 'backdrop', 'banner', 'horizon', 'photo', 'off'));
