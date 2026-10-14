-- Импорт кандидатов из candidates.txt.
-- Выполнить целиком в Supabase Dashboard -> SQL Editor.
-- Скрипт идемпотентный: повторный запуск не создаёт дубликаты.

begin;

-- Временно освобождаем уникальные sort_order, чтобы безопасно переставить категории.
update public.slago_nominations
set sort_order = -(sort_order + 1000);

with source(slug, title, sort_order, is_featured) as (
  values
    ('legend-year', 'Легенда года', 1, true),
    ('meme-year', 'Мем года', 2, false),
    ('active-year', 'Актив года', 3, false),
    ('xer-year', 'Ксер года', 4, false),
    ('golden-burger', 'Премия золотого бургера', 5, true),
    ('zavoz-year', 'Завоз года', 6, false),
    ('doter-year', 'Дотер года', 7, true),
    ('ivan-zolo-year', 'Иван Золо года', 8, false),
    ('toxic-year', 'Токсик года', 9, false),
    ('charisma-year', 'Харизма года', 10, false),
    ('kind-year', 'Добряк года', 11, false),
    ('sex-symbol-year', 'Секс символ года', 12, false)
)
insert into public.slago_nominations (slug, title, sort_order, is_featured, is_active)
select slug, title, sort_order, is_featured, true
from source
on conflict (slug) do update
set title = excluded.title,
    sort_order = excluded.sort_order,
    is_featured = excluded.is_featured,
    is_active = true;

-- Старую дополнительную карточку оставляем в конце списка.
update public.slago_nominations
set sort_order = 13
where slug = 'zavoz-year-2';

-- Удаляем только стартовые заглушки, созданные schema.sql.
delete from public.slago_nominees nominee
using public.slago_nominations nomination
where nominee.nomination_id = nomination.id
  and nominee.name = '???'
  and nomination.slug in (
    'legend-year', 'meme-year', 'active-year', 'xer-year',
    'golden-burger', 'zavoz-year', 'doter-year', 'ivan-zolo-year',
    'toxic-year', 'charisma-year', 'kind-year', 'sex-symbol-year'
  );

with source(slug, name, sort_order) as (
  values
    ('legend-year', 'Максим Ветш', 1),
    ('legend-year', 'Ярослав Ханчиков', 2),
    ('legend-year', 'Леня Шоколадный-Гений', 3),
    ('legend-year', 'Дмитрий Липтон', 4),
    ('legend-year', 'Семён Мазалов', 5),
    ('legend-year', 'Ярослав Блессед', 6),
    ('legend-year', 'Илья Монеси', 7),
    ('legend-year', 'Михаил Потужнич', 8),
    ('legend-year', 'Геннадий Арбузов', 9),
    ('legend-year', 'Павлик', 10),
    ('legend-year', 'Ваня Шпага', 11),
    ('legend-year', 'Максим Лосс', 12),
    ('legend-year', 'Антон Шурупов', 13),
    ('legend-year', 'Даня Ед.', 14),
    ('meme-year', 'Дима Шуруп', 1),
    ('meme-year', 'Матвей tea_bag', 2),
    ('meme-year', 'Илья Монеси', 3),
    ('meme-year', 'Павлик', 4),
    ('active-year', 'Григорий Грейроков', 1),
    ('active-year', 'Максим Ветш', 2),
    ('active-year', 'Матвей tea_bag', 3),
    ('active-year', 'Владислав Яторович', 4),
    ('active-year', 'Павлик', 5),
    ('xer-year', 'Дмитрий Клатчер', 1),
    ('xer-year', 'Максим Лосс', 2),
    ('xer-year', 'Ваня Шпага', 3),
    ('xer-year', 'Григорий Грейроков', 4),
    ('xer-year', 'Матвей tea_bag', 5),
    ('golden-burger', 'Ярик Ханчиков', 1),
    ('golden-burger', 'Павлик', 2),
    ('golden-burger', 'Даня Ед.', 3),
    ('golden-burger', 'Семён Мазалов', 4),
    ('zavoz-year', 'Миша(война с бобруйском)', 1),
    ('zavoz-year', 'Дима Липтон(10 стаков алмазов)', 2),
    ('doter-year', 'Даня Ед', 1),
    ('doter-year', 'Владислав Яторович', 2),
    ('doter-year', 'Павлик', 3),
    ('doter-year', 'Леня Шоколадный-Гений', 4),
    ('doter-year', 'Дима Липтон', 5),
    ('ivan-zolo-year', 'Максим Ветш', 1),
    ('ivan-zolo-year', 'Илья Монеси', 2),
    ('ivan-zolo-year', 'Айвар', 3),
    ('ivan-zolo-year', 'Даня Ед.', 4),
    ('toxic-year', 'Геннадий Арбузов', 1),
    ('toxic-year', 'Матвей tea_bag', 2),
    ('toxic-year', 'Павлик', 3),
    ('toxic-year', 'Григорий Грейроков', 4),
    ('charisma-year', 'Павлик', 1),
    ('charisma-year', 'Максим Лосс', 2),
    ('kind-year', 'Илья Монеси', 1),
    ('kind-year', 'Даниил Пенни', 2),
    ('kind-year', 'Дмитрий Клатчер', 3),
    ('kind-year', 'Коля Азотов', 4),
    ('kind-year', 'Ярослав Блессед', 5),
    ('sex-symbol-year', 'Меха', 1),
    ('sex-symbol-year', 'Матвей tea_bag', 2),
    ('sex-symbol-year', 'Семён Мазалов', 3),
    ('sex-symbol-year', 'Ярослав Ханчиков', 4),
    ('sex-symbol-year', 'Павлик', 5)
)
insert into public.slago_nominees (nomination_id, name, sort_order)
select nomination.id, source.name, source.sort_order
from source
join public.slago_nominations nomination on nomination.slug = source.slug
on conflict (nomination_id, sort_order) do update
set name = excluded.name;

commit;

-- Быстрая проверка после импорта:
select nomination.title, count(nominee.id) as candidates
from public.slago_nominations nomination
left join public.slago_nominees nominee on nominee.nomination_id = nomination.id
where nomination.slug <> 'zavoz-year-2'
group by nomination.sort_order, nomination.title
order by nomination.sort_order;
