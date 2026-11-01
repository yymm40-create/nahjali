-- «المسابقة»: 2 to 6 teams, each with its own name, emoji and colour, and players added by the leader. A race already running keeps its teams and points.
-- Safe to run twice. Run this BEFORE the code that reads `teams` goes live.

alter table public.mahdi_races add column if not exists teams jsonb not null default '[]';

update public.mahdi_races
set teams = jsonb_build_array(
  jsonb_build_object('id', 'a', 'name', team_a, 'emoji', emoji_a, 'color', '#F5C542'),
  jsonb_build_object('id', 'b', 'name', team_b, 'emoji', emoji_b, 'color', '#46C971'))
where teams = '[]'::jsonb;

alter table public.mahdi_race_players drop constraint if exists mahdi_race_players_team_check;
alter table public.mahdi_race_players add constraint mahdi_race_players_team_check check (team ~ '^[a-h]$');
alter table public.mahdi_race_points drop constraint if exists mahdi_race_points_team_check;
alter table public.mahdi_race_points add constraint mahdi_race_points_team_check check (team ~ '^[a-h]$');
alter table public.mahdi_races drop constraint if exists mahdi_races_winner_check;
alter table public.mahdi_races add constraint mahdi_races_winner_check check (winner = 'tie' or winner ~ '^[a-h]$');

-- Players the leader adds by hand (kids with no phone): no account behind them, so the row's id no longer points at one.
alter table public.mahdi_race_players drop constraint if exists mahdi_race_players_user_id_fkey;
alter table public.mahdi_race_players add column if not exists guest boolean not null default false;

notify pgrst, 'reload schema';
