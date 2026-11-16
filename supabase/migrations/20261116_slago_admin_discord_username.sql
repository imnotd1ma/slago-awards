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
        'voter_name', coalesce(p.discord_username, identity_data.username, u.raw_user_meta_data ->> 'username', u.raw_user_meta_data ->> 'global_name', p.username, v.voter_id::text),
        'discord_username', coalesce(p.discord_username, identity_data.username, u.raw_user_meta_data ->> 'username'),
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
      left join auth.users u on u.id = v.voter_id
      left join lateral (
        select i.identity_data ->> 'username' as username
        from auth.identities i
        where i.user_id = v.voter_id and i.provider = 'discord'
        limit 1
      ) identity_data on true
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
