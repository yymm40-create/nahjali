-- «الذكاء الإسلامي»: ذاكرة المحادثات. كل محادثة تنحفظ بأسئلتها وأجوبتها ومصادرها، فترجع لها بعد التحديث أو من
-- جهاز ثاني، والأسئلة اللاحقة تُفهم من سياقها. للخادم فقط (RLS مفعّل وبلا صلاحيات للمتصفح). آمن لو شُغّل مرة ثانية.

create table if not exists public.islamic_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 120),
  messages jsonb not null default '[]'::jsonb,
  usd numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists islamic_chats_user_idx on public.islamic_chats (user_id, updated_at desc);
alter table public.islamic_chats enable row level security;
revoke all on public.islamic_chats from anon, authenticated;
