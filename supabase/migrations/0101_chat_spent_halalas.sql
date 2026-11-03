-- «أُخذ منك بالضبط في هذي المحادثة»: a running total (halalas, NOT an estimate) of what was really taken from the
-- wallet across every turn of each saved robot conversation — separate from the existing `usd` column some of these
-- tables already keep (that one is the provider's raw cost before margin and rounding, used for profit accounting;
-- this one is the exact, already-rounded, already-margined amount the ledger actually took, turn by turn). Shown next
-- to the model picker (ClaudeModelPicker's `spent` prop) instead of the "~typical reply" estimate once a conversation
-- has taken anything, and survives reload because it is read back with the chat.
alter table public.content_chats     add column if not exists spent_halalas integer not null default 0;
alter table public.kharq_chats       add column if not exists spent_halalas integer not null default 0;
alter table public.islamic_chats     add column if not exists spent_halalas integer not null default 0;
alter table public.designer_chats    add column if not exists spent_halalas integer not null default 0;
alter table public.games_chats       add column if not exists spent_halalas integer not null default 0;
alter table public.booklet_chats     add column if not exists spent_halalas integer not null default 0;
alter table public.sajjad_chats      add column if not exists spent_halalas integer not null default 0;
alter table public.motion_lab_chats  add column if not exists spent_halalas integer not null default 0;
alter table public.editor_chats      add column if not exists spent_halalas integer not null default 0;
