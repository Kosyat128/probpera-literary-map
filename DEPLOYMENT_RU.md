# Развёртывание «Пробы Пера»

## До публикации

```text
npm ci
npm run lint
npm test
npm run links:audit
npm run countries:audit
npm run covers:audit
npm run assets:globe:qa
npm run build:all
npm run build:domain
```

## Публичный сайт

GitHub Actions собирает Vite-приложение и размещает папку `dist` на GitHub
Pages. Для текущего временного адреса используются:

```text
PUBLIC_SITE_ORIGIN=https://kosyat128.github.io
PUBLIC_SITE_BASE_PATH=/probpera-literary-map
```

В GitHub Secrets должны быть публичные параметры Supabase. Приватный
`service_role` не нужен публичной сборке и не должен попадать в браузер.

## Редакционная панель

`apps/admin` — серверное Next.js-приложение. GitHub Pages не запускает сервер,
поэтому панель разворачивается отдельно на Vercel или другом Node.js-хостинге.
Конфигурация уже использует `basePath: /admin`, защитные заголовки и запрет
индексации.

Обязательные серверные переменные перечислены в `.env.example`. Deployment
hook связывает публикацию в панели с новой публичной сборкой.

## Проверка выпуска

Проверяются:

1. главная, глобус, выбор и контуры стран;
2. архив, рецензии, рейтинг и комментарии книги;
3. статьи, книжный режим, источники и комментарии;
4. регистрация и роли;
5. панель на телефоне и компьютере;
6. `sitemap.xml`, `robots.txt`, RSS, canonical и Open Graph;
7. старые URL и отсутствие цепочек редиректов.

Переключение DNS не входит в обычную публикацию и выполняется только по
отдельному решению владельца.

`npm run build:domain` создаёт проверенный пакет `dist` для корня
`https://probpera.ru`, но сам домен не переключает. Полная последовательность
зафиксирована в `FINAL_PRE_MIGRATION_CHECKLIST_RU.md`.
