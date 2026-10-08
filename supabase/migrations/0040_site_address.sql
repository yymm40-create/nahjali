-- The site moved to www.aljawadai.app (the old nahjali.vercel.app now forwards to it, and the database's web calls
-- do not follow a forward): every scheduled job that calls the site is pointed at the new address. Safe to run again.

do $$
declare
  j record;
begin
  for j in select jobid, command from cron.job where command ~ 'https?://[^/'']*(vercel\.app|aljawadai\.app)' loop
    perform cron.alter_job(
      j.jobid,
      command := regexp_replace(j.command, 'https?://[^/'']*(vercel\.app|aljawadai\.app)', 'https://www.aljawadai.app', 'g')
    );
  end loop;
end $$;

select jobname, substring(command from 'https?://[^'']+') as calls from cron.job order by jobname;
