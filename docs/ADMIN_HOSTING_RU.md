# Серверное размещение редакционной панели

Публичная часть «Пробы Пера» остаётся статической и не получает приватных
ключей. Редакционная панель `apps/admin` развёртывается отдельно как Next.js
Worker. Основной адрес — `https://admin.probpera.ru`: он не смешивает
GitHub Pages и серверные маршруты панели под одним `/admin`.

## Основное размещение: Cloudflare Workers

Панель адаптирована для Workers через OpenNext. Конфигурация хранится рядом с
приложением:

- `apps/admin/wrangler.jsonc` — Worker, ассеты и домен;
- `apps/admin/open-next.config.ts` — адаптер Next.js;
- `npm run cf:deploy --workspace @probpera/admin` — проверенная сборка
  и публикация;
- `npm run cf:preview --workspace @probpera/admin` — локальная проверка
  в среде Workers.

Первый deploy можно выполнить через Wrangler после входа в аккаунт Cloudflare.
После проверки временного адреса Worker домен `admin.probpera.ru` подключается
как Custom Domain. Cloudflare сам создаёт нужную DNS-привязку и выпускает HTTPS;
отдельную A- или CNAME-запись для этого Worker вручную создавать не нужно.

Публичные переменные `NEXT_PUBLIC_*` и `ADMIN_BASE_PATH` должны быть доступны
уже во время сборки: Next.js встраивает их в клиентский код. Эти же значения,
а также серверные переменные, задаются в Cloudflare Dashboard в разделе Worker
Settings → Variables and Secrets. Для Production используются:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SITE_URL=https://probpera.ru
NEXT_PUBLIC_ADMIN_URL=https://admin.probpera.ru
ADMIN_BASE_PATH=/
ADMIN_ALLOWED_ORIGINS=admin.probpera.ru
GITHUB_DEPLOY_TOKEN=
GITHUB_DEPLOY_REPOSITORY=Kosyat128/probpera-literary-map
GITHUB_DEPLOY_WORKFLOW=deploy-pages.yml
GITHUB_DEPLOY_REF=main
GOOGLE_BOOKS_API_KEY=
OPENAI_API_KEY=
OPENAI_TRANSLATION_MODEL=gpt-5.6-sol
OPENAI_AUTO_TRANSLATE_ARTICLES=true
YANDEX_METRIKA_COUNTER_ID=
```

`GITHUB_DEPLOY_TOKEN` — серверный fine-grained token только для указанного
репозитория с разрешением Actions: read and write. Он не должен иметь префикс
`NEXT_PUBLIC_` и не должен храниться в Git.

`OPENAI_API_KEY` — серверный Secret Worker, используемый только автоматическим
английским переводчиком статей. Его нельзя объявлять как `NEXT_PUBLIC_*` или
`VITE_*`. `OPENAI_TRANSLATION_MODEL` и `OPENAI_AUTO_TRANSLATE_ARTICLES` не
содержат секрета и могут храниться как обычные Variables. Значение по умолчанию
для модели — `gpt-5.6-sol`, а автоперевод включён, если флаг не установлен в
`false`.

Если переменные создавались через Dashboard, при ручном deploy используйте
параметр `--keep-vars`, чтобы Wrangler не удалил их. В `apps/admin/wrangler.jsonc`
также включён `keep_vars: true`, поэтому автоматический deploy из GitHub не
должен удалять сохранённые в Worker Variables и Secrets. Приватные значения
добавляются как Secrets: после сохранения Cloudflare не показывает их повторно.

Автоматический deploy из `main` выполняет
`.github/workflows/deploy-admin.yml`. Для него в GitHub Actions Secrets нужны:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Cloudflare API Token ограничивается разрешениями редактирования Workers Scripts
и Workers Routes только нужной учётной записи и зоны `probpera.ru`.

Перед включением трафика проверяется итоговый размер Worker. Бесплатный Workers
имеет более строгие ограничения на размер и процессорное время; если собранная
панель их превышает, переход на Workers Paid выполняется только после отдельного
подтверждения владельца.

## Подготовленный контейнер

В корне проекта находятся:

- `Dockerfile.admin` — production standalone-сборка Next.js;
- `docker-compose.admin.example.yml` — пример запуска только на локальном
  порту `127.0.0.1:3000`, который затем закрывается HTTPS-прокси;
- `apps/admin/.env.example` — полный список переменных.

Скопируйте пример compose-файла в локальный, задайте секреты вне Git и
выполните:

```text
docker compose -f docker-compose.admin.yml build --pull
docker compose -f docker-compose.admin.yml up -d
```

Внешний прокси должен направлять `admin.probpera.ru` на
`http://127.0.0.1:3000`, выпускать HTTPS-сертификат и сохранять заголовки
`Host`/`X-Forwarded-Proto`. Сам контейнер не публикует порт в интернет.

## Обязательные секреты

- `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` могут
  присутствовать в клиентской части;
- deployment hook — только серверная переменная;
- `OPENAI_API_KEY` — только серверный Secret, если включён автоматический
  английский перевод;
- ни один приватный ключ не должен иметь префикс `NEXT_PUBLIC_` или `VITE_`.

`SUPABASE_SERVICE_ROLE_KEY` не передаётся контейнеру панели. Он допустим только
в отдельном доверенном процессе импорта или резервного копирования и никогда
не нужен для обычного входа редактора.

Для поддомена сборка использует `ADMIN_BASE_PATH=/`. Если панель размещается
за общим прокси в `https://probpera.ru/admin`, контейнер необходимо собрать с
`ADMIN_BASE_PATH=/admin` и проксировать весь этот префикс без переписывания
внутренних путей.

В Supabase Auth оставьте Site URL `https://probpera.ru` и добавьте точные
Redirect URLs:

```text
https://admin.probpera.ru/auth/callback
https://admin.probpera.ru/reset-password
http://127.0.0.1:3000/admin/auth/callback
http://127.0.0.1:3000/admin/reset-password
```

Загрузка изображений проходит после клиентской оптимизации: исходный файл
уменьшается без обрезки, очищается от лишних метаданных и передаётся в Worker
как WebP. Сервер повторно проверяет тип, размер и геометрию файла перед записью
в Supabase Storage.

## Приёмка до DNS

1. Открыть временный HTTPS-адрес панели.
2. Проверить вход владельца, выход и полный цикл восстановления пароля.
3. Создать черновик, пройти публикационный чек-лист и открыть предпросмотр.
4. Проверить загрузку изображения, шаблоны блоков и восстановление ревизии.
5. Проверить очереди комментариев/форума и экран «Состояние сайта».
6. Убедиться, что исходный HTML не содержит `service_role`.
7. Только после этого добавлять DNS-запись `admin`.
