# SLAGO Awards

Одностраничный сайт голосования. До подключения базы он показывает все девять номинаций с временными номинантами `???`; после подключения данные берутся из Supabase.

## Подключение Supabase и Discord

1. Создай проект в [Supabase](https://supabase.com/dashboard), открой **SQL Editor** и выполни содержимое `supabase/schema.sql`.
2. В **Project Settings → API** скопируй `Project URL` и `anon public key`, затем вставь их в `SUPABASE_URL` и `SUPABASE_ANON_KEY` в `app.js`. Публичный anon key можно хранить на фронтенде: доступ защищают политики RLS в SQL.
3. В [Discord Developer Portal](https://discord.com/developers/applications) создай приложение: **OAuth2 → General**. Скопируй Client ID и Client Secret.
4. В Supabase открой **Authentication → Providers → Discord**, включи провайдер и вставь эти два значения. Redirect URL для Discord возьми из подсказки в настройках провайдера Supabase (обычно `https://<project-ref>.supabase.co/auth/v1/callback`).
5. В **Authentication → URL Configuration** добавь адрес сайта в `Site URL` и `Redirect URLs`. Для локальной проверки: `http://localhost:5500` (или адрес твоего локального сервера). Для продакшена добавь домен полностью.
6. Опубликуй папку на Vercel, Netlify, GitHub Pages или любом статическом хостинге и повтори шаг 5 с его URL.

## Номинанты

Пока в каждой номинации лежит три `???`. Менять имена можно напрямую в Table Editor → `nominees`, либо SQL-запросом. Не меняй номинации во время открытого голосования без необходимости: уникальная пара `voter_id + nomination_id` не даст одному Discord-пользователю проголосовать з�� категорию дважды.

«Завоз года» из задания присутствует дважды, вторая карточка названа «Завоз года II», чтобы это были разные категории в базе.

## Главные номинации, аватары и порядок

Для уже созданной базы один раз выполни `supabase/migrations/20260813_featured_nomination_design.sql` в SQL Editor. Миграция добавляет:

- `nominations.is_featured`: включи флаг, чтобы номинация отображалась крупной в блоке «Главные номинации»;
- `nominees.avatar_url`: вставь публичную HTTPS-ссылку на картинку — сайт покажет её рядом с именем кандидата;
- `nominations.sort_order`: определяет порядок карточек. Измени значения в Table Editor или вызови `public.reorder_nominations(...)` из SQL Editor с UUID всех номинаций в нужной последовательности.
