-- Впиши Discord ID напротив исходного имени кандидата и выполни файл в SQL Editor.
-- Повторяющееся имя свяжет этого участника во всех номинациях.
-- Discord ID: Discord -> User Settings -> Advanced -> Developer Mode,
-- затем правой кнопкой по участнику -> Copy User ID.

with mapping(original_name, discord_id) as (
  values
    ('ИМЯ КАНДИДАТА', 'DISCORD_USER_ID')
    -- , ('Другое имя', '123456789012345678')
)
update public.slago_nominees nominee
set discord_id = mapping.discord_id
from mapping
where lower(trim(nominee.name)) = lower(trim(mapping.original_name))
returning nominee.name, nominee.discord_id, nominee.nomination_id;
