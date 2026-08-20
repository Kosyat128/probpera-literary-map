# Проверка безопасности опубликованных сайтов

Отдельный workflow `Audit live production security` запускается после успешной публикации сайта или админки, раз в сутки и вручную. Он проверяет оба домена, но не является шагом deploy-workflow: ошибка внешней конфигурации видна в Actions, не отменяя уже выполненную публикацию.

Проверяются:

- ответ `301` или `308` с HTTP на тот же HTTPS-адрес без потери пути и query-параметров;
- HSTS, `X-Content-Type-Options`, строгая `Referrer-Policy`, ограничения `Permissions-Policy` и защита от встраивания;
- доступный `/.well-known/security.txt` с контактом, будущим сроком действия и правильным `Canonical`.

Локально или из CI проверку можно запустить так:

```powershell
npm run release:smoke:live
```

## Внешняя настройка Cloudflare

Код публикует `security.txt` и объявляет нужные заголовки, но GitHub Pages не применяет файл `_headers`. До зелёного live-аудита в Cloudflare для зоны `probpera.ru` требуется:

1. оставить `Always Use HTTPS` включённым и применить управляемое Single
   Redirect Rule `probpera-zone-http-to-https-v1`; именно live-ответ, а не одно
   значение zone setting, должен подтвердить постоянный redirect для
   `probpera.ru` и `admin.probpera.ru` с сохранением пути и query;
2. для публичного хоста добавить Response Header Transform Rule, передающую значения из `dist/_headers`: HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` и CSP с `frame-ancestors https://admin.probpera.ru`;
3. после следующей публикации убедиться, что оба `/.well-known/security.txt`
   доступны. Workflow настройки Cloudflare автоматически запускает этот аудит
   после apply; его также можно перезапустить вручную.

Админка уже формирует защитные заголовки в Next.js. Обычный deploy не меняет
внешнюю конфигурацию Cloudflare: владелец зоны применяет её отдельным защищённым
workflow `Configure Cloudflare edge security`.
