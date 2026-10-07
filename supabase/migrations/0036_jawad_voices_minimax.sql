-- The voice library takes voices from MiniMax too (through fal.ai): copied from a recording, no slot limit there.
-- Run once in Supabase after 0035. Safe to run again.
alter table public.jawad_voices drop constraint if exists jawad_voices_provider_check;
alter table public.jawad_voices add constraint jawad_voices_provider_check check (provider in ('elevenlabs', 'minimax'));
-- a MiniMax voice id may be short
alter table public.jawad_voices drop constraint if exists jawad_voices_provider_voice_id_check;
alter table public.jawad_voices add constraint jawad_voices_provider_voice_id_check check (char_length(provider_voice_id) between 2 and 128);
