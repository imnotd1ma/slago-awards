-- Select which existing Legend of the Year nominees appear on the ballot.
alter table public.slago_nominees
  add column if not exists is_legend_year_selected boolean not null default false;

-- After nominees have Discord IDs, select the chosen candidates like this:
-- update public.slago_nominees
-- set is_legend_year_selected = false
-- where nomination_id = (select id from public.slago_nominations where slug = 'legend-year');
--
-- update public.slago_nominees
-- set is_legend_year_selected = true
-- where nomination_id = (select id from public.slago_nominations where slug = 'legend-year')
--   and discord_id in ('DISCORD_ID_1', 'DISCORD_ID_2');
