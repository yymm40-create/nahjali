-- MiniMax is gone from the site (the owner, 1 November 2026): its generator off, and the voices saved there deleted.
-- Safe to run more than once.
update public.jawad_generators set enabled = false, updated_at = now() where id = 'minimax-speech-2-8';
delete from public.jawad_voices where provider = 'minimax';
