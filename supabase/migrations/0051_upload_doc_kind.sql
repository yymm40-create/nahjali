-- «يقدر يرسل PDF لصانع المحتوى أو غيره»: an upload can now also be a PDF document, so a person attaches a lecture,
-- a report or a form to any robot's conversation and the robot reads its pages itself.
-- Generators still take only image / video / audio references (checked in code).
alter table jawad_uploads drop constraint if exists jawad_uploads_kind_check;
alter table jawad_uploads add constraint jawad_uploads_kind_check check (kind in ('image', 'video', 'audio', 'doc'));
