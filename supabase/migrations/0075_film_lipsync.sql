-- «👄 طابق الشفايف على الصوت»: a film take's mouth redrawn on its dialogue audio (Sync Lipsync on fal.ai) is its own
-- paid operation, counted under its own service.
alter table public.film_jobs drop constraint if exists film_jobs_service_check;
alter table public.film_jobs add constraint film_jobs_service_check
  check (service in ('anthropic', 'openai_image', 'seedance', 'elevenlabs', 'lipsync'));
