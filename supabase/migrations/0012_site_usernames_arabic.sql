-- Usernames: Arabic letters allowed (the name people already use becomes their username).
-- Run once in Supabase after 0010: Dashboard → SQL Editor → paste → Run.
-- Rule: 3–20 characters, Arabic or lowercase Latin letters, digits and _, starting with a letter. Still unique.
alter table public.site_usernames drop constraint if exists site_usernames_username_check;
alter table public.site_usernames add constraint site_usernames_username_check
  check (username ~ '^[a-zء-غف-ي][a-z0-9_ء-غف-ي]{2,19}$');
