-- Впиши Discord ID напротив исходного имени кандидата и выполни файл в SQL Editor.
-- Один и тот же Discord ID можно указывать для кандидата в разных номинациях.
-- Если у одного участника разные исходные имена, перечисли каждое с тем же ID.
-- Discord ID: Discord -> User Settings -> Advanced -> Developer Mode,
-- затем правой кнопкой по участнику -> Copy User ID.

with mapping(original_name, discord_id) as (
  values
    ('ИМЯ КАНДИДАТА', 'DISCORD_USER_ID')
    -- , ('Другое имя этого же кандидата', 'DISCORD_USER_ID')
)
update public.slago_nominees nominee
set discord_id = mapping.discord_id
from mapping
where lower(trim(nominee.name)) = lower(trim(mapping.original_name))
returning nominee.name, nominee.discord_id, nominee.nomination_id;
