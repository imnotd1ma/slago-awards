-- Выполни в том же Supabase-проекте Secret Gate после schema.sql.
-- Edge Function Secret Gate вызывает эту функцию после синхронизации Discord.

alter table public.slago_nominees
  add column if not exists discord_id text,
  add column if not exists discord_username text;

alter table public.slago_nominees
  drop constraint if exists slago_nominees_discord_id_key;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.slago_nominees'::regclass
      and conname = 'slago_nominees_nomination_discord_id_key'
  ) then
    alter table public.slago_nominees
      add constraint slago_nominees_nomination_discord_id_key unique (nomination_id, discord_id);
  end if;
end $$;

create or replace function public.sync_slago_nominees(p_members jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  if jsonb_typeof(p_members) <> 'array' then raise exception 'INVALID_MEMBERS'; end if;

  with source as (
    select * from jsonb_to_recordset(p_members) as member(
      discord_id text,
      username text,
      discord_username text,
      avatar_url text
    )
  ), matches as (
    select nominee.id as nominee_id, min(source.discord_id) as discord_id
    from public.slago_nominees nominee
    join source on nominee.discord_id = source.discord_id
      or (nominee.discord_id is null and (
        lower(trim(nominee.name)) = lower(trim(source.username))
        or lower(trim(nominee.name)) = lower(trim(source.discord_username))
      ))
    group by nominee.id
    having count(distinct source.discord_id) = 1
  )
  update public.slago_nominees nominee
  set discord_id = matches.discord_id,
      name = source.username,
      discord_username = source.discord_username,
      avatar_url = source.avatar_url
  from matches
  join source on source.discord_id = matches.discord_id
  where nominee.id = matches.nominee_id;

  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke all on function public.sync_slago_nominees(jsonb) from public, anon, authenticated;
grant execute on function public.sync_slago_nominees(jsonb) to service_role;
