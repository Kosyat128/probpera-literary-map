# Управляемая защита Cloudflare для `probpera.ru`

Workflow `Configure Cloudflare edge security` безопасно сверяет и при явном
разрешении применяет внешнюю конфигурацию, которую GitHub Pages сам обеспечить
не может. По умолчанию запуск является только чтением (`apply=false`).

Он строго привязан к активной зоне `probpera.ru` в аккаунте из секрета
`CLOUDFLARE_ACCOUNT_ID` и использует токен из `CLOUDFLARE_API_TOKEN`. Значения секретов,
идентификаторы зоны и ruleset не выводятся в журнал. Для токена нужны как минимум:

- Zone / Zone Settings: Read и Edit;
- Zone / Single Redirect: Edit;
- Zone / Transform Rules: Read и Edit;
- Zone / Cache Rules: Read и Edit;
- Zone / Zone: Read.

## Что управляется

1. `Always Use HTTPS = on` остаётся включённым как дополнительная зональная
   защита.
2. Одно zone-level Single Redirect Rule в фазе
   `http_request_dynamic_redirect` со стабильным `ref`
   `probpera-zone-http-to-https-v1`. Оно срабатывает только для незашифрованных
   запросов (`not ssl`) к `probpera.ru` и `admin.probpera.ru`, возвращает `308`
   на тот же host и path и сохраняет query string. Поэтому HTTPS-запросы не
   попадают в цикл. Новое управляемое правило явно добавляется в конец ruleset,
   а существующее обновляется на своей текущей позиции: оно не может затенить
   более раннее ручное правило и не меняет взаимный порядок посторонних правил.
3. Одно Response Header Transform Rule со стабильным `ref`
   `probpera-public-security-response-headers-v1`. Выражение строго
   `(http.host eq "probpera.ru")`, поэтому правило не меняет ответы админки.
   Оно задаёт те же защитные заголовки, что объявлены для публичной сборки в
   `dist/_headers`: CSP, HSTS, `nosniff`, строгий `Referrer-Policy`, отключение
   camera/microphone/geolocation/payment и COOP `same-origin`.
4. Одно Cache Rule со стабильным `ref`
   `probpera-public-immutable-assets-cache-v1`: годовой browser/edge TTL только
   для хешированных Vite-ресурсов `/assets/*` публичного хоста. Редакционные
   каталоги `/assets/country-flags/*` и `/assets/writer-portraits/*`, а также
   `/textures/*` и `/brand/*` намеренно не входят в это правило, поскольку их
   стабильные имена не гарантируют неизменяемость содержимого.

Скрипт добавляет или обновляет только правила с собственными `ref` через API
одного правила. Посторонние правила не отправляются обратно целиком и не
удаляются. Дубли собственных `ref`, неоднозначная зона, неполная пагинация и
потенциально пересекающиеся ручные header/cache rules вызывают отказ до записи.
Для Single Redirect действует более строгая fail-closed проверка: до любой
записи каждое включённое постороннее правило должно быть доказуемо непересекающимся
с незашифрованным трафиком обоих целевых хостов (например, только `ssl` или
другой точный host). Незнакомое или сложное выражение считается потенциальным
пересечением и останавливает apply. Отключённые правила сохраняются, но не
блокируют применение. После apply повторное чтение проверяет не только наличие
управляемого правила, но и прежние порядок и семантическое содержимое каждого
постороннего redirect rule.

Значение `always_use_https=on` в API подтверждает только сохранённую настройку,
но не является проверкой фактического HTTP-ответа. После apply workflow поэтому
запускает live-аудит: для обоих хостов он требует `301` или `308`, обязательный
`Location` и точное сохранение host/path/query. Явный Single Redirect является
репозиторно управляемым механизмом принудительного HTTPS, в том числе перед
маршрутизацией Worker. Это соответствует
[рекомендации Cloudflare по миграции Always Use HTTPS](https://developers.cloudflare.com/rules/reference/page-rules-migration/#migrate-always-use-https)
и API-фазе
[`http_request_dynamic_redirect`](https://developers.cloudflare.com/rules/url-forwarding/single-redirects/create-api/).
Cloudflare документирует, что добавление одного правила без позиции помещает
его в конец; configurator задаёт эквивалентную явную позицию `after: ""`:
[Add a rule to a ruleset](https://developers.cloudflare.com/ruleset-engine/rulesets-api/add-rule/).

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
