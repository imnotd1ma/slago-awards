-- Выполни этот файл в Supabase Dashboard → SQL Editor → New query.
-- Slago shares the Secret Gate Supabase project; prefix its tables to avoid
-- colliding with Secret Gate's public.profiles and public.votes.
create table if not exists public.slago_nominations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  sort_order smallint not null unique,
  is_featured boolean not null default false,
  is_active boolean not null default true
);
create table if not exists public.slago_nominees (
  id uuid primary key default gen_random_uuid(),
  nomination_id uuid not null references public.slago_nominations(id) on delete cascade,
  name text not null,
  discord_id text unique,
  discord_username text,
  avatar_url text,
  sort_order smallint not null default 1,
  unique (nomination_id, sort_order)
);
create table if not exists public.slago_votes (
  id bigint generated always as identity primary key,
  voter_id uuid not null references auth.users(id) on delete cascade,
  nomination_id uuid not null references public.slago_nominations(id) on delete cascade,
  nominee_id uuid references public.slago_nominees(id) on delete cascade,
  custom_nominee text,
  created_at timestamptz not null default now(),
  unique (voter_id, nomination_id)
);
-- Для уже созданной базы: добавляет поле для своих номинантов и делает nominee_id необязательным.
alter table public.slago_votes add column if not exists custom_nominee text;
alter table public.slago_votes alter column nominee_id drop not null;
alter table public.slago_votes drop constraint if exists slago_votes_choice_check;
alter table public.slago_votes add constraint slago_votes_choice_check check (
  (nominee_id is not null and custom_nominee is null) or
  (nominee_id is null and custom_nominee is not null and char_length(trim(custom_nominee)) between 1 and 70)
);
alter table public.slago_nominations enable row level security;
alter table public.slago_nominees enable row level security;
alter table public.slago_votes enable row level security;
create policy "Anyone may view active Slago nominations" on public.slago_nominations for select using (is_active = true);
create policy "Anyone may view Slago nominees" on public.slago_nominees for select using (true);
create policy "Users may submit own Slago votes" on public.slago_votes for insert to authenticated with check (auth.uid() = voter_id);

-- Гарантирует, что номинант относится к номинации, даже если запрос подменён в браузере.
create or replace function public.ensure_matching_slago_nominee() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.nominee_id is not null and not exists (select 1 from public.slago_nominees where id = new.nominee_id and nomination_id = new.nomination_id) then
    raise exception 'Nominee does not belong to this nomination';
  end if;
  return new;
end; $$;
create trigger validate_slago_vote_nominee before insert or update on public.slago_votes for each row execute function public.ensure_matching_slago_nominee();

insert into public.slago_nominations (slug, title, sort_order, is_featured) values
  ('legend-year', 'Легенда года', 1, true), ('golden-burger', 'Премия золотого бургера', 2, true), ('doter-year', 'Дотер года', 3, true),
  ('xer-year', 'Ксер года', 4, false), ('meme-year', 'Мем года', 5, false), ('zavoz-year', 'Завоз года', 6, false),
  ('active-year', 'Актив года', 7, false), ('zavoz-year-2', 'Завоз года II', 8, false), ('toxic-year', 'Токсик года', 9, false)
on conflict (slug) do nothing;
insert into public.slago_nominees (nomination_id, name, sort_order)
select id, '???', 1 from public.slago_nominations on conflict (nomination_id, sort_order) do nothing;
insert into public.slago_nominees (nomination_id, name, sort_order)
select id, '???', 2 from public.slago_nominations on conflict (nomination_id, sort_order) do nothing;
insert into public.slago_nominees (nomination_id, name, sort_order)
select id, '???', 3 from public.slago_nominations on conflict (nomination_id, sort_order) do nothing;
