# Управляемая защита Cloudflare для `probpera.ru`

Workflow `Configure Cloudflare edge security` безопасно сверяет и при явном
разрешении применяет внешнюю конфигурацию, которую GitHub Pages сам обеспечить
не может. По умолчанию запуск является только чтением (`apply=false`).

Он строго привязан к активной зоне `probpera.ru` в аккаунте из секрета
`CLOUDFLARE_ACCOUNT_ID` и использует токен из `CLOUDFLARE_API_TOKEN`. Значения секретов,
идентификаторы зоны и ruleset не выводятся в журнал. Для токена нужны как минимум:

- Zone / Zone Settings: Read и Edit;
- Zone / Transform Rules: Read и Edit;
- Zone / Cache Rules: Read и Edit;
- Zone / Zone: Read.

## Что управляется

1. `Always Use HTTPS = on` для зоны.
2. Одно Response Header Transform Rule со стабильным `ref`
   `probpera-public-security-response-headers-v1`. Выражение строго
   `(http.host eq "probpera.ru")`, поэтому правило не меняет ответы админки.
   Оно задаёт те же защитные заголовки, что объявлены для публичной сборки в
   `dist/_headers`: CSP, HSTS, `nosniff`, строгий `Referrer-Policy`, отключение
   camera/microphone/geolocation/payment и COOP `same-origin`.
3. Одно Cache Rule со стабильным `ref`
   `probpera-public-immutable-assets-cache-v1`: годовой browser/edge TTL только
   для хешированных Vite-ресурсов `/assets/*` публичного хоста. Редакционные
   каталоги `/assets/country-flags/*` и `/assets/writer-portraits/*`, а также
   `/textures/*` и `/brand/*` намеренно не входят в это правило, поскольку их
   стабильные имена не гарантируют неизменяемость содержимого.

Скрипт добавляет или обновляет только правило с собственным `ref` через API
одного правила. Посторонние правила не отправляются обратно целиком и не
удаляются. Дубли собственных `ref`, неоднозначная зона, неполная пагинация и
потенциально пересекающиеся ручные правила вызывают отказ до записи.

## Порядок ручного запуска

1. Открыть Actions → `Configure Cloudflare edge security` → Run workflow на
   ветке `main`.
2. Вставить точный 40-символьный SHA текущего `main`, оставить `apply=false` и
   проверить dry-run. Он выполняет только запросы GET.
3. Для применения повторить запуск с тем же актуальным SHA, выбрать
   `apply=true` и ввести без изменений:

   `APPLY PROBPERA CLOUDFLARE EDGE`

Перед записью workflow повторно сравнивает текущий удалённый `main` с одобренным
SHA. После записи скрипт заново читает настройки и требует точного совпадения.

Локальный dry-run допустим только через переменные окружения; секреты нельзя
передавать аргументами командной строки или сохранять в `.env`:

```powershell
node scripts/cloudflare/configure-edge-security.mjs --apply=false
```

## Почему `/.well-known/security.txt` может отсутствовать на GitHub Pages

`actions/upload-pages-artifact@v5` по умолчанию исключает каталоги, имя которых
начинается с точки. Поэтому файл `dist/.well-known/security.txt` существует в
сборке, но не попадает в Pages artifact, если не включить скрытые файлы.

Безопасное исправление deploy-workflow: перед загрузкой проверить точный файл и
передать action явный параметр:

```yaml
- name: Verify public security contact
  run: test -s dist/.well-known/security.txt

- name: Upload production artifact
  uses: actions/upload-pages-artifact@v5
  with:
    path: dist
    include-hidden-files: true
```

Перед включением параметра следует сохранить отдельную проверку, что в `dist`
нет `.env`, ключей и иных скрытых служебных файлов. Этот документ фиксирует
необходимое изменение; сам deploy-workflow меняется в рамках его отдельного
релизного hardening, чтобы не создавать конфликтующих правок.
