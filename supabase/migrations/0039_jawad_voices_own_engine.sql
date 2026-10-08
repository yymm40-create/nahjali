-- «صوت الجواد»: the site's own voice engine. A voice of its library is a reference recording kept in storage
-- (provider_voice_id = its path) and the words said in it (reference_text, what Habibi needs), copied free of charge.
alter table public.jawad_voices drop constraint if exists jawad_voices_provider_check;
alter table public.jawad_voices add constraint jawad_voices_provider_check check (provider in ('elevenlabs', 'minimax', 'jawad'));

alter table public.jawad_voices drop constraint if exists jawad_voices_provider_voice_id_check;
alter table public.jawad_voices add constraint jawad_voices_provider_voice_id_check check (char_length(provider_voice_id) between 2 and 200);

alter table public.jawad_voices add column if not exists reference_text text not null default '';
