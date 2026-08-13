-- Миграция для УЖЕ созданной базы SLAGO Awards.
-- Выполни только этот файл в Supabase Dashboard → SQL Editor.
-- Полный supabase/schema.sql повторно запускать не нужно.

-- Позволяет сохранять собственного номинанта вместо кандидата из списка.
alter table public.votes
  add column if not exists custom_nominee text;

-- При собственном номинанте nominee_id остаётся пустым.
alter table public.votes
  alter column nominee_id drop not null;

-- Голос должен содержать ровно один вариант: кандидата из списка ИЛИ своё имя.
alter table public.votes
  drop constraint if exists votes_choice_check;

alter table public.votes
  add constraint votes_choice_check check (
    (nominee_id is not null and custom_nominee is null)
    or
    (nominee_id is null and custom_nominee is not null and char_length(trim(custom_nominee)) between 1 and 70)
  );

-- Обновляет проверку соответствия кандидата номинации:
-- для собственного номинанта nominee_id отсутствует, это допустимо.
create or replace function public.ensure_matching_nominee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.nominee_id is not null and not exists (
    select 1
    from public.nominees
    where id = new.nominee_id
      and nomination_id = new.nomination_id
  ) then
    raise exception 'Nominee does not belong to this nomination';
  end if;

  return new;
end;
$$;
