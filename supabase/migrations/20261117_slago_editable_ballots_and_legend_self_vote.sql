-- Remove any update permission previously configured for Slago ballots.
drop policy if exists "Users may update own Slago votes" on public.slago_votes;

create or replace function public.enforce_slago_voting_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.slago_vote_settings s where s.singleton and s.is_open
      and (s.starts_at is null or now() >= s.starts_at)
      and (s.ends_at is null or now() < s.ends_at)
  ) then
    raise exception 'VOTING_CLOSED';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_slago_voting_window on public.slago_votes;
create trigger enforce_slago_voting_window
  before insert on public.slago_votes
  for each row execute function public.enforce_slago_voting_window();

create or replace function public.prevent_slago_vote_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'SLAGO_VOTES_CANNOT_BE_CHANGED';
end;
$$;

drop trigger if exists prevent_slago_vote_update on public.slago_votes;
create trigger prevent_slago_vote_update
  before update on public.slago_votes
  for each row execute function public.prevent_slago_vote_update();

create or replace function public.ensure_matching_slago_nominee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nomination_slug text;
  voter_discord_id text;
  nominee_discord_id text;
begin
  select slug into nomination_slug from public.slago_nominations where id = new.nomination_id;
  select discord_id into voter_discord_id from public.profiles where id = new.voter_id;

  if new.nominee_id is not null then
    if new.custom_nominee is not null or new.custom_nominee_discord_id is not null then
      raise exception 'INVALID_NOMINEE';
    end if;

    select discord_id into nominee_discord_id
    from public.slago_nominees
    where id = new.nominee_id and nomination_id = new.nomination_id;

    if not found then raise exception 'INVALID_NOMINEE'; end if;
  elsif new.custom_nominee_discord_id is not null then
    select discord_id into nominee_discord_id
    from public.profiles
    where discord_id = new.custom_nominee_discord_id
      and lower(trim(username)) = lower(trim(new.custom_nominee));

    if not found or exists (
      select 1 from public.slago_nominees n
      where n.nomination_id = new.nomination_id
        and (n.discord_id = new.custom_nominee_discord_id or (
          n.discord_id is null and lower(trim(n.name)) in (
            lower(trim(new.custom_nominee)),
            (select lower(trim(p.discord_username)) from public.profiles p where p.discord_id = new.custom_nominee_discord_id)
          )
        ))
    ) then
      raise exception 'USER_NOT_AVAILABLE_FOR_NOMINATION';
    end if;
  else
    select discord_id into nominee_discord_id
    from public.profiles
    where lower(trim(username)) = lower(trim(new.custom_nominee));

    if not found or exists (
      select 1 from public.slago_nominees n
      where n.nomination_id = new.nomination_id
        and lower(trim(n.name)) in (
          lower(trim(new.custom_nominee)),
          (select lower(trim(p.discord_username)) from public.profiles p where p.discord_id = nominee_discord_id)
        )
    ) then
      raise exception 'USER_NOT_AVAILABLE_FOR_NOMINATION';
    end if;
  end if;

  if nomination_slug = 'legend-year'
    and voter_discord_id is not null
    and nominee_discord_id = voter_discord_id then
    raise exception 'CANNOT_VOTE_FOR_SELF';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_slago_vote_nominee on public.slago_votes;
create trigger validate_slago_vote_nominee
  before insert on public.slago_votes
  for each row execute function public.ensure_matching_slago_nominee();

drop function if exists public.get_my_slago_votes();
create function public.get_my_slago_votes()
returns table (
  nomination_slug text,
  nomination_title text,
  nominee_id uuid,
  nominee_name text,
  custom_nominee text,
  custom_nominee_discord_id text
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select n.slug, n.title, v.nominee_id, sn.name,
    v.custom_nominee, v.custom_nominee_discord_id
  from public.slago_votes v
  join public.slago_nominations n on n.id = v.nomination_id
  left join public.slago_nominees sn on sn.id = v.nominee_id
  where v.voter_id = auth.uid()
  order by n.sort_order;
$$;

revoke all on function public.get_my_slago_votes() from public;
grant execute on function public.get_my_slago_votes() to authenticated;

-- Reset only Legend of the Year ballots. Other nomination votes are preserved.
delete from public.slago_votes v
using public.slago_nominations n
where v.nomination_id = n.id
  and n.slug = 'legend-year';
