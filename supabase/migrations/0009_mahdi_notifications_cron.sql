-- «لأجل المهدي»: runs the reminder dispatcher every 15 minutes (Supabase pg_cron + pg_net).
-- Run in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run again: it replaces the same job.
--
-- Before you run it, change the two values marked  <<<  below:
--   1. SITE_URL    your site's address with no slash at the end (the production domain)
--   2. CRON_SECRET the same value as MAHDI_CRON_SECRET in your hosting environment
--                  (scripts/generate-mahdi-vapid.mts prints one). Do not share this file after filling it in.
--
-- The dispatcher is  POST {SITE_URL}/api/mahdi/notifications/dispatch  with  Authorization: Bearer <secret>.
-- To stop it later:  select cron.unschedule('mahdi-notifications');
-- To see the last runs:  select * from cron.job_run_details order by start_time desc limit 10;
--                        select id, status_code, content from net._http_response order by created desc limit 10;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
declare
  site_url    text := 'https://YOUR-SITE.example';        -- <<< 1. SITE_URL
  cron_secret text := 'PUT-THE-SAME-SECRET-HERE';         -- <<< 2. CRON_SECRET
  secret_id   uuid;
begin
  if site_url like '%YOUR-SITE%' or cron_secret like 'PUT-THE-SAME%' or length(cron_secret) < 24 then
    raise exception 'Edit site_url and cron_secret at the top of this block first (the secret needs at least 24 characters).';
  end if;
  if site_url like '%/' then
    raise exception 'site_url must not end with a slash.';
  end if;

  -- The secret is kept in Supabase Vault (encrypted), not written inside the cron job text
  select id into secret_id from vault.secrets where name = 'mahdi_cron_secret';
  if secret_id is null then
    perform vault.create_secret(cron_secret, 'mahdi_cron_secret', 'Bearer secret for the «لأجل المهدي» reminder dispatcher');
  else
    perform vault.update_secret(secret_id, cron_secret);
  end if;

  perform cron.schedule(
    'mahdi-notifications',
    '*/15 * * * *',
    format(
      $job$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'mahdi_cron_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 55000
      );
      $job$,
      site_url || '/api/mahdi/notifications/dispatch'
    )
  );
end
$$;
