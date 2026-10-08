-- «الذكاء الإسلامي»: reads the sources by itself every 5 minutes (Supabase pg_cron + pg_net), so the library fills
-- with no page open. Nothing to edit: the site address and the secret are taken from the «لأجل المهدي» job
-- (migration 0009), which must have been run first. Safe to run again: it replaces the same job.
--
-- To stop it later:  select cron.unschedule('islamic-read');
-- To see the last runs:  select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'islamic-read') order by start_time desc limit 10;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
declare
  site_url text;
begin
  select substring(command from 'https?://[^/'']+') into site_url from cron.job where jobname = 'mahdi-notifications';
  if site_url is null then
    raise exception 'Run migration 0009 (mahdi-notifications) first: this job takes the site address and the secret from it.';
  end if;
  if not exists (select 1 from vault.secrets where name = 'mahdi_cron_secret') then
    raise exception 'The secret mahdi_cron_secret is missing from Vault: run migration 0009 first.';
  end if;

  perform cron.schedule(
    'islamic-read',
    '*/5 * * * *',
    format(
      $job$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'mahdi_cron_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 250000
      );
      $job$,
      site_url || '/api/islamic/cron'
    )
  );
end
$$;
