create or replace function public.get_my_slago_votes()
returns table (
  nomination_slug text,
  nomination_title text,
  nominee_id uuid,
  nominee_name text,
  custom_nominee text
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select n.slug, n.title, v.nominee_id, sn.name, v.custom_nominee
  from public.slago_votes v
  join public.slago_nominations n on n.id = v.nomination_id
  left join public.slago_nominees sn on sn.id = v.nominee_id
  where v.voter_id = auth.uid()
  order by n.sort_order;
$$;

revoke all on function public.get_my_slago_votes() from public;
grant execute on function public.get_my_slago_votes() to authenticated;
