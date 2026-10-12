-- «إخوة الولاية»: a join link (and QR code) for a group. Whoever opens it asks to join ('requested'); the leader accepts.
alter table public.mahdi_groups add column if not exists join_token text unique;
alter table public.mahdi_group_members drop constraint if exists mahdi_group_members_status_check;
alter table public.mahdi_group_members add constraint mahdi_group_members_status_check check (status in ('invited', 'active', 'requested'));
