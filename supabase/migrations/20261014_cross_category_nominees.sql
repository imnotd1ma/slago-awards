-- Add zavoz descriptions and restrict custom ballot choices to candidates
-- already listed in a different nomination.

alter table public.slago_nominees
  add column if not exists description text;

alter table public.slago_votes
  add column if not exists custom_nominee_discord_id text;

alter table public.slago_votes
  drop constraint if exists slago_votes_choice_check;
alter table public.slago_votes
  add constraint slago_votes_choice_check check (
    (nominee_id is not null and custom_nominee is null and custom_nominee_discord_id is null)
    or
    (nominee_id is null and custom_nominee is not null and char_length(trim(custom_nominee)) between 1 and 70)
  );

create or replace function public.ensure_matching_slago_nominee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.nominee_id is not null then
    if new.custom_nominee is not null or new.custom_nominee_discord_id is not null or not exists (
      select 1 from public.slago_nominees
      where id = new.nominee_id and nomination_id = new.nomination_id
    ) then
      raise exception 'INVALID_NOMINEE';
    end if;
  elsif new.custom_nominee_discord_id is not null then
    if not exists (
      select 1 from public.slago_nominees
      where discord_id = new.custom_nominee_discord_id
        and nomination_id <> new.nomination_id
        and lower(trim(name)) = lower(trim(new.custom_nominee))
    ) then
      raise exception 'NOMINEE_MUST_BE_FROM_ANOTHER_CATEGORY';
    end if;
  elsif not exists (
    select 1 from public.slago_nominees
    where nomination_id <> new.nomination_id
      and lower(trim(name)) = lower(trim(new.custom_nominee))
  ) then
    raise exception 'NOMINEE_MUST_BE_FROM_ANOTHER_CATEGORY';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_slago_vote_nominee on public.slago_votes;
create trigger validate_slago_vote_nominee
  before insert or update on public.slago_votes
  for each row execute function public.ensure_matching_slago_nominee();
