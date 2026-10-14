-- Выполни один раз в Supabase Dashboard → SQL Editor.
-- Добавляет большие «главные» номинации, аватары кандидатов и удобную смену порядка.

alter table public.slago_nominations
  add column if not exists is_featured boolean not null default false;

alter table public.slago_nominees
  add column if not exists avatar_url text;

-- По умолчанию три первые номинации становятся главными. Измени условие или флаги в Table Editor по своему вкусу.
update public.slago_nominations
set is_featured = true
where sort_order <= 3;

-- Безопасно переставляет все номинации в порядке UUID из массива.
-- Пример:
-- select public.reorder_slago_nominations(array[
--   'uuid-первой-номинации'::uuid,
--   'uuid-второй-номинации'::uuid
-- ]);
create or replace function public.reorder_slago_nominations(ordered_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  position integer;
begin
  if cardinality(ordered_ids) <> (select count(*) from public.slago_nominations) then
    raise exception 'Передай UUID всех номинаций ровно по одному разу';
  end if;

  if (select count(distinct submitted.input_id) from unnest(ordered_ids) as submitted(input_id)) <> cardinality(ordered_ids)
     or exists (
       select 1
       from unnest(ordered_ids) as submitted(input_id)
       where not exists (select 1 from public.slago_nominations as nomination where nomination.id = submitted.input_id)
     ) then
    raise exception 'В массиве есть повторяющийся или несуществующий UUID номинации';
  end if;

  -- Временные отрицательные значения обходят уникальное ограничение sort_order.
  update public.slago_nominations set sort_order = -sort_order;
  for position in 1..cardinality(ordered_ids) loop
    update public.slago_nominations set sort_order = position where id = ordered_ids[position];
  end loop;
end;
$$;

-- Только владелец базы может менять порядок через эту функцию.
revoke execute on function public.reorder_slago_nominations(uuid[]) from public, anon, authenticated;

comment on column public.slago_nominations.sort_order is 'Порядок карточек на сайте: меньшее число показывается раньше.';
comment on column public.slago_nominations.is_featured is 'Показывать номинацию крупной карточкой в блоке «Главные номинации».';
comment on column public.slago_nominees.avatar_url is 'Публичный HTTPS URL аватара номинанта.';
