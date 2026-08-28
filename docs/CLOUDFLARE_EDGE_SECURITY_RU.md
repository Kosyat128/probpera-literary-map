# Управляемая защита Cloudflare для `probpera.ru`

## Текущая production-политика

Для публичного `probpera.ru` доступность из РФ имеет приоритет. Apex работает в режиме **DNS only / direct delivery** и не должен принудительно переводиться на Cloudflare proxy. Репозиторий проверяет это по фактическому live-ответу: наличие `CF-Ray` на публичном origin считается неожиданным включением Cloudflare edge и блокирует direct-origin production audit.

`admin.probpera.ru` остаётся отдельным Cloudflare/Worker-контуром и продолжает проходить строгую проверку HTTPS и security headers.

Cloudflare Response Header Transform Rules, Cache Rules и Single Redirect Rules применимы к посетительскому трафику только когда соответствующий hostname реально проходит через Cloudflare edge. Поэтому сохранённое и успешно прочитанное обратно правило в API не считается доказательством, что оно действует на публичный `probpera.ru` в режиме DNS only.

Перед любым `apply=true` workflow `Configure Cloudflare edge security` выполняет read-only preflight `scripts/cloudflare/verify-edge-applicability.mjs`. Если публичный origin не проходит через Cloudflare, apply останавливается **до любых API-мутаций**. Dry-run при этом разрешён и показывает фактический edge state.

## Что проверяется для прямого публичного origin

`Audit live production security` разделяет два профиля:

1. `probpera.ru` - direct/DNS-only profile:
   - Cloudflare proxy должен оставаться выключенным (`CF-Ray` отсутствует);
   - HTTP должен корректно переводиться на HTTPS с сохранением host/path/query;
   - HTTPS-корень должен быть доступен;
   - `/.well-known/security.txt` должен быть доступен как `text/plain` и содержать валидные Contact, Expires и Canonical.
2. `admin.probpera.ru` - strict edge profile:
   - HTTPS;
   - HSTS;
   - `X-Content-Type-Options: nosniff`;
   - строгий `Referrer-Policy`;
   - `Permissions-Policy`;
   - frame protection через X-Frame-Options или CSP;
   - корректный `security.txt`.

Серверные security headers публичного GitHub Pages origin не используются как release gate, потому что при DNS-only они не могут быть добавлены Cloudflare Transform Rules. Это осознанный компромисс в пользу стабильной прямой доступности из РФ; строгий header profile сохраняется для админки.

## Репозиторно управляемые Cloudflare правила

Configurator `scripts/cloudflare/configure-edge-security.mjs` по-прежнему умеет безопасно сверять конфигурацию зоны и предназначен для случаев, когда edge path сознательно активирован. Он управляет:

- `Always Use HTTPS`;
- zone-level Single Redirect Rule `probpera-zone-http-to-https-v1`;
- Response Header Transform Rule `probpera-public-security-response-headers-v1`;
- Cache Rule `probpera-public-immutable-assets-cache-v1`.

Однако для текущего публичного production режима эти правила **не следует применять**, пока `probpera.ru` остаётся DNS only. Preflight специально не переключает proxy автоматически.

## Ручной workflow

`Configure Cloudflare edge security` можно безопасно запускать в dry-run режиме для диагностики. Для `apply=true` требуется точный SHA `main`, точная подтверждающая фраза и активный live Cloudflare edge path. Если `probpera.ru` идёт напрямую, workflow откажется до записи.

Таким образом, случайное включение Cloudflare proxy или попытка применить edge-only политику к bypass-трафику больше не должны проходить незамеченными.
