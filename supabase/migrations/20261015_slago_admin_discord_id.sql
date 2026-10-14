create or replace function public.is_slago_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.profiles p
    join auth.users u on u.id = auth.uid()
    left join auth.identities i on i.user_id = u.id and i.provider = 'discord'
    where p.is_admin is true
      and p.discord_id = coalesce(
        nullif(u.raw_user_meta_data ->> 'provider_id', ''),
        nullif(u.raw_user_meta_data ->> 'sub', ''),
        nullif(i.identity_data ->> 'provider_id', ''),
        nullif(i.identity_data ->> 'sub', '')
      )
  );
$$;

revoke all on function public.is_slago_admin() from public, anon;
grant execute on function public.is_slago_admin() to authenticated;
