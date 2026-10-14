-- Включает Realtime для обновлений списка номинаций и кандидатов.
drop policy if exists "Anyone may view active Slago nominations" on public.slago_nominations;
drop policy if exists "Anyone may view Slago nominations" on public.slago_nominations;
create policy "Anyone may view Slago nominations"
  on public.slago_nominations for select using (true);

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'slago_nominations'
  ) then
    alter publication supabase_realtime add table public.slago_nominations;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'slago_nominees'
  ) then
    alter publication supabase_realtime add table public.slago_nominees;
  end if;
end $$;
