-- «ذاكرتي»: لكل حساب ذاكرة واحدة تعرف صاحبها: وش يبي، مشاريعه، أفكاره المعتادة، أسلوبه. الروبوتات تقرأها في كل
-- محادثة وتحدّثها بعد كل رد. صاحبها يشوفها ويعدّلها ويمسحها، ويطفيها كليًا أو لمحادثة وحدة. للخادم فقط. آمن لو شُغّل مرة ثانية.

create table if not exists public.user_memory (
  user_id uuid primary key references auth.users (id) on delete cascade,
  enabled boolean not null default true,
  notes text not null default '' check (char_length(notes) <= 6000),
  updated_at timestamptz not null default now()
);
alter table public.user_memory enable row level security;
revoke all on public.user_memory from anon, authenticated;
