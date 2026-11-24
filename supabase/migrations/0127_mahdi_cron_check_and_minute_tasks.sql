-- «لأجل المهدي» · the notifications reach nobody (the owner, 24 November 2026): every call of the 15-minute dispatcher got
-- 404, because MAHDI_CRON_SECRET was never set on the hosting. Now the site checks the caller's secret against the one
-- kept here in Supabase Vault (mahdi_cron_secret, from 0009) — nothing to copy by hand. Also: the timed tasks and the
-- planner alerts are sent on their minute, by a second job every minute (only those two: they are marked once sent,
-- so a minute's run never sends one twice); the rest stays every 15 minutes.
-- Run in Supabase: Dashboard → SQL Editor → paste → Run. Safe to run twice. Needs 0009 (the secret in the Vault).

-- the site asks: is this the dispatcher's secret? (only the server's service role may ask)
create or replace function public.mahdi_cron_ok(p_token text)
returns boolean
language sql stable security definer set search_path = public, vault as $$
  select coalesce(length(p_token) >= 24 and p_token = (select decrypted_secret from vault.decrypted_secrets where name = 'mahdi_cron_secret' limit 1), false);
$$;
revoke all on function public.mahdi_cron_ok(text) from public, anon, authenticated;
grant execute on function public.mahdi_cron_ok(text) to service_role;

-- every minute: the timed tasks and the planner alerts, on their minute (same address and secret as the 15-minute job)
do $$
declare
  url text;
begin
  select substring(command from 'url := ''([^'']+)''') into url from cron.job where jobname = 'mahdi-notifications';
  if url is null then
    raise exception 'Run 0009 first (the job mahdi-notifications is missing).';
  end if;
  perform cron.schedule(
    'mahdi-minute-alerts',
    '* * * * *',
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
      url || '?only=minute'
    )
  );
end
$$;
