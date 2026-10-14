create table if not exists public.slago_vote_settings (
  singleton boolean primary key default true check (singleton),
  is_open boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  results_final boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.slago_vote_settings (singleton) values (true) on conflict (singleton) do nothing;
alter table public.slago_vote_settings enable row level security;
revoke all on public.slago_vote_settings from anon, authenticated;

create or replace function public.is_slago_admin()
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin is true);
$$;
revoke all on function public.is_slago_admin() from public, anon;
grant execute on function public.is_slago_admin() to authenticated;

create or replace function public.get_slago_vote_status()
returns jsonb language sql stable security definer set search_path = public as $$
  select to_jsonb(s) || jsonb_build_object(
    'accepting_votes', s.is_open
      and (s.starts_at is null or now() >= s.starts_at)
      and (s.ends_at is null or now() < s.ends_at)
  )
  from public.slago_vote_settings s where s.singleton;
$$;
revoke all on function public.get_slago_vote_status() from public;
grant execute on function public.get_slago_vote_status() to anon, authenticated;

create or replace function public.get_slago_admin_data()
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare
  result jsonb;
begin
  if not public.is_slago_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select jsonb_build_object(
    'settings', (select to_jsonb(s) from public.slago_vote_settings s where singleton),
    'votes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'created_at', v.created_at,
        'voter_id', v.voter_id,
        'voter_name', coalesce(p.username, p.discord_username, v.voter_id::text),
        'discord_username', p.discord_username,
        'avatar_url', p.avatar_url,
        'nomination_id', v.nomination_id,
        'nomination_title', n.title,
        'nominee_name', coalesce(sn.name, v.custom_nominee),
        'nominee_id', v.nominee_id,
        'custom_nominee_discord_id', v.custom_nominee_discord_id
      ) order by v.created_at desc)
      from public.slago_votes v
      join public.slago_nominations n on n.id = v.nomination_id
      left join public.slago_nominees sn on sn.id = v.nominee_id
      left join public.profiles p on p.id = v.voter_id
    ), '[]'::jsonb),
    'statistics', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nomination_id', counts.nomination_id,
        'nomination_title', counts.nomination_title,
        'nominee_name', counts.nominee_name,
        'votes', counts.votes
      ) order by counts.sort_order, counts.votes desc, counts.nominee_name)
      from (
        select n.id as nomination_id, n.title as nomination_title, n.sort_order,
          sn.name as nominee_name, count(v.id)::integer as votes
        from public.slago_nominations n
        join public.slago_nominees sn on sn.nomination_id = n.id
        left join public.slago_votes v on v.nominee_id = sn.id
        group by n.id, n.title, n.sort_order, sn.id, sn.name
        union all
        select n.id, n.title, n.sort_order, v.custom_nominee, count(v.id)::integer
        from public.slago_nominations n
        join public.slago_votes v on v.nomination_id = n.id and v.nominee_id is null
        group by n.id, n.title, n.sort_order, v.custom_nominee
      ) counts
    ), '[]'::jsonb),
    'voter_count', (select count(distinct voter_id)::integer from public.slago_votes),
    'vote_count', (select count(*)::integer from public.slago_votes)
  ) into result;
  return result;
end;
$$;
revoke all on function public.get_slago_admin_data() from public, anon;
grant execute on function public.get_slago_admin_data() to authenticated;

create or replace function public.update_slago_vote_settings(
  requested_open boolean,
  requested_starts_at timestamptz,
  requested_ends_at timestamptz,
  requested_results_final boolean
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare updated public.slago_vote_settings;
begin
  if not public.is_slago_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if requested_starts_at is not null and requested_ends_at is not null and requested_ends_at <= requested_starts_at then
    raise exception 'INVALID_VOTING_WINDOW';
  end if;
  insert into public.slago_vote_settings (singleton, is_open, starts_at, ends_at, results_final, updated_at)
  values (true, requested_open, requested_starts_at, requested_ends_at, requested_results_final, now())
  on conflict (singleton) do update set is_open = excluded.is_open,
    starts_at = excluded.starts_at, ends_at = excluded.ends_at,
    results_final = excluded.results_final, updated_at = now()
  returning * into updated;
  return to_jsonb(updated) || jsonb_build_object('accepting_votes', updated.is_open
    and (updated.starts_at is null or now() >= updated.starts_at)
    and (updated.ends_at is null or now() < updated.ends_at));
end;
$$;
revoke all on function public.update_slago_vote_settings(boolean, timestamptz, timestamptz, boolean) from public, anon;
grant execute on function public.update_slago_vote_settings(boolean, timestamptz, timestamptz, boolean) to authenticated;

create or replace function public.enforce_slago_voting_window()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.slago_vote_settings s where s.singleton and s.is_open
      and (s.starts_at is null or now() >= s.starts_at)
      and (s.ends_at is null or now() < s.ends_at)
  ) then raise exception 'VOTING_CLOSED'; end if;
  return new;
end;
$$;
drop trigger if exists enforce_slago_voting_window on public.slago_votes;
create trigger enforce_slago_voting_window before insert on public.slago_votes
for each row execute function public.enforce_slago_voting_window();
