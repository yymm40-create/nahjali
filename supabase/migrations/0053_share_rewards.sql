-- «انشرنا واربح»: من ينشر الجواد الذكي في ستوري انستغرام ويسوّي منشن لحسابنا، يضغط «نشرت ✅» باسم حسابه، ويوصل
-- للمالك في تيليجرام؛ إذا أكّد تنضاف المكافأة لرصيده مرة واحدة فقط. للخادم فقط (RLS مفعّل وبلا صلاحيات). آمن لو شُغّل مرة ثانية.

create table if not exists public.share_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text,
  handle text not null check (char_length(handle) between 1 and 30),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reward_halalas integer not null default 0,
  credited_at timestamptz,
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists share_claims_user_idx on public.share_claims (user_id, created_at desc);
create index if not exists share_claims_status_idx on public.share_claims (status, created_at desc);
-- one reward per person, ever
create unique index if not exists share_claims_one_approved on public.share_claims (user_id) where status = 'approved';
alter table public.share_claims enable row level security;
revoke all on public.share_claims from anon, authenticated;

-- the owner's switch and the reward (key «enabled» = on/off, key «reward» = riyals)
create table if not exists public.share_kv (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.share_kv enable row level security;
revoke all on public.share_kv from anon, authenticated;
