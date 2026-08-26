# Runbook: российский direct route для `probpera.ru`

Этот runbook fail-closed. Команды без `apply` только читают состояние. Любая
запись в production требует exact SHA актуального `main`, полного snapshot,
успешного direct TLS proof и точной confirmation-строки.

Текущее решение на 24 августа 2026 года: **оставить production за Cloudflare**.
GitHub Pages direct content исправен, но сертификат не покрывает
`probpera.ru`, GitHub Pages DNS check не завершён, `Enforce HTTPS` выключен, а
port 80 direct origin отвечает plaintext `200`. Аварийный gray-cloud запрещён.

## 1. Локальный read-only аудит

Требуется Node.js 24. Секреты для сетевого аудита не нужны.

```powershell
npm run connectivity:audit -- --mode=global --host=probpera.ru --json
npm run connectivity:audit -- --mode=direct --host=probpera.ru --json
npm run connectivity:test
```

Global-проверка должна подтвердить HTTPS, DNS A/AAAA, redirect, release SHA,
HTML/canonical, sitemap, robots, RSS, security.txt, service worker и статические
assets. Direct-проверка выполняет принудительный connect к каждому официальному
Pages IPv4/IPv6, сохраняя `Host` и SNI. Запрещено использовать
`rejectUnauthorized=false`: ошибка имени сертификата является результатом
`direct_tls_not_ready`, а не warning.

Для привязки проверки к release:

```powershell
node scripts/network/audit-connectivity.mjs `
  --mode=global `
  --host=probpera.ru `
  --release-sha=0123456789abcdef0123456789abcdef01234567 `
  --json
```

Отчёт не должен содержать response body, DNS record IDs, account ID или токен.

## 2. Cloudflare inventory и snapshot

Cloudflare credentials передаются только через environment/GitHub Secrets:

- `CLOUDFLARE_API_TOKEN`;
- `CLOUDFLARE_ACCOUNT_ID`.

Минимальные права для inspect/snapshot: Zone Read, DNS Read и DNSSEC Read для
единственной зоны `probpera.ru`. Для отдельного apply-run добавляется DNS Edit.
Не выдавать Account/Workers/Supabase permissions.

Read-only inventory:

```powershell
node scripts/cloudflare/manage-ru-connectivity.mjs inspect
```

Полный snapshot до любой записи:

```powershell
node scripts/cloudflare/manage-ru-connectivity.mjs snapshot `
  --snapshot=artifacts/probpera-dns-before.json `
  --expected-main-sha=0123456789abcdef0123456789abcdef01234567
```

Snapshot обязан включать все страницы A/AAAA/CNAME/CAA/MX/TXT/SRV, TTL,
proxy flags и DNSSEC state. Если API pagination неполна, зона неоднозначна,
встречен неподдерживаемый тип или отсутствует `admin.probpera.ru`, операция
останавливается. В stdout выводится только redacted summary. Raw JSON остаётся
только на ephemeral runner; перед upload он шифруется AES-256-GCM:

```powershell
node scripts/cloudflare/protect-ru-snapshot.mjs encrypt `
  --input=artifacts/probpera-dns-before.json `
  --output=artifacts/probpera-dns-before.enc.json
```

Для disposable read-only snapshot workflow допускает HKDF из существующего
высокоэнтропийного `CLOUDFLARE_API_TOKEN`. `apply-direct` и `rollback` требуют
отдельный versioned environment secret `RU_CONNECTIVITY_SNAPSHOT_KEYRING_JSON`;
без него mutation fail-closed. Формат keyring:

```json
{"activeKeyId":"2026-08-a","keys":{"2026-08-a":"<минимум 32 случайных байта>"}}
```

Envelope содержит аутентифицированный `keyId`. При ротации новый ключ становится
`activeKeyId`, а предыдущий остаётся в `keys` весь срок жизни apply artifact;
поэтому старый снимок расшифровывается без смены workflow input. В Actions
загружается только encrypted envelope: disposable read-only artifact на два дня,
apply-only rollback artifact на 90 дней.

## 3. Direct HTTPS gate

До DNS/GeoDNS работ GitHub Pages settings/API должны одновременно показывать:

```text
cname = probpera.ru
status = built (или эквивалентный ready)
https_enforced = true
```

После восстановления GitHub CLI точная read-only проверка:

```powershell
gh api repos/Kosyat128/probpera-literary-map/pages `
  --jq '{status,cname,https_enforced,html_url,build_type,source}'
```

Затем direct-аудит проверяет оба публичных hostname на каждом A и AAAA. JSON
proof считается действительным только если:

- сертификат доверен и SAN покрывает проверяемый hostname;
- negotiated TLS работает без отключения hostname verification;
- HTTP перенаправляет на тот же HTTPS URL;
- root и critical endpoints доступны;
- отдельный крупный HTML/asset body больше 16 KiB;
- release SHA равен exact SHA `main`;
- выборочный legacy alias даёт живой 301/308 на exact canonical target; portable
  HTTP 200 meta-refresh страница остаётся fallback, но не делает proof eligible;
- proof содержит `probpera.ru` и `www.probpera.ru`, IPv4 и IPv6;
- proof свежий и имеет `status: passed`.

GitHub-hosted runner обычно не имеет outbound IPv6. Внешний forced-AAAA
Globalping diagnostic доказывает Host/SNI, HTTP/2, TLS/headers и release-head,
но не может связать крупный CMS/article/PWA/assets body целиком. Поэтому такой
fallback намеренно оставляет `proofEligible=false`; production gate требует
trusted dual-stack runner или provider-adapter с полной content-integrity
привязкой.

Для долгосрочного использования GitHub Pages нужно отдельное доказательство,
что certificate renewal продолжит работать при RU→Pages и
DEFAULT→Cloudflare Partial. Если GitHub DNS check видит не Pages route, разовая
выдача сертификата недостаточна: выбрать direct edge/origin с custom cert или
DNS-01 renewal и синхронной публикацией того же artifact.

Это human-reviewed evidence, а не boolean: redacted файл хранится в
`config/dns/evidence/`, plan содержит его SHA-256 и merged PR URL, validator
пересчитывает bytes, а mutation workflow требует independent APPROVED review
exact evidence commit. Допустимо либо письменное provider/support подтверждение
split-DNS renewal, либо наблюдаемый полный renewal cycle; evidence PR старше 90
дней требует нового review.

Поля provider/ASN/IP внутри plan не являются доказательством сами по себе.
Generic validator не разрешает `custom-edge` apply, пока для конкретного
поставщика не реализован workflow-produced attested adapter с полной DNS chain,
независимым ASN lookup, исключением Cloudflare и привязкой к artifact SHA.

Текущий proof этим требованиям не соответствует. Нельзя подделывать proof,
удалять IPv6 из списка или временно отключать TLS verification.

## 4. Подготовка GeoDNS без смены NS

Внешнюю зону сначала создать как неавторитетную/staging:

1. Импортировать полный Cloudflare snapshot без потери MX/TXT/CAA/SRV.
2. Оставить приложение, Worker, auth/cookies/callbacks и policy admin
   семантически неизменными, но создать внешний DNS target
   `admin.probpera.ru.cdn.cloudflare.net` для всех стран.
3. Создать для `probpera.ru` и `www.probpera.ru` две симметричные политики:
   - RU country/ECS → доказанный custom-cert direct edge; Pages ALIAS/A+AAAA
     допустим только после подтверждения renewal;
   - DEFAULT → точный per-host Cloudflare Partial CNAME target.
4. Сохранить обе address families; нельзя оставлять RU AAAA на Cloudflare.
5. Установить TTL 60–300 секунд для routing records и сохранить исходные TTL
   остальных записей.
6. Создать immutable версии `candidate` и `rollback`; переключение между ними
   должно быть одной API-операцией поставщика.
7. Проверить ответы staging nameserver с RU ECS и без ECS, затем с несколькими
   public recursive resolvers. Resolver без ECS может классифицироваться по
   адресу/PoP resolver, поэтому это отдельный тест, а не гарантия страны клиента.

Для рекомендуемой схемы Cloudflare API должен заранее подтвердить
Business/Enterprise Partial setup и exact target apex, `www` и admin. До
full→partial conversion активировать Advanced Certificate для всех трёх имён:
Cloudflare удаляет Universal SSL при conversion. Подготовить delegated DCV и
постоянный verification TXT во внешней зоне, затем проверить admin Partial
target на staging.
Если домен зарегистрирован в Cloudflare Registrar или plan не поддерживает
Partial, NS не менять: сначала подготовить альтернативный global edge.

## 5. Reviewed dry-run

После успешного TLS proof:

```powershell
node scripts/cloudflare/manage-ru-connectivity.mjs plan-direct `
  --expected-main-sha=0123456789abcdef0123456789abcdef01234567 `
  --pages-hostname=Kosyat128.github.io `
  --tls-proof=artifacts/direct-proof.json
```

Перед apply management workflow привязывает attested proof к свежему snapshot:

```powershell
node scripts/cloudflare/manage-ru-connectivity.mjs bind-proof `
  --expected-main-sha=0123456789abcdef0123456789abcdef01234567 `
  --pages-hostname=Kosyat128.github.io `
  --snapshot=artifacts/probpera-dns-before.json `
  --tls-proof=artifacts/direct-proof.json `
  --bound-proof=artifacts/direct-proof-bound.json
```

План обязан перечислить только ожидаемые public records. Любое упоминание
`admin.probpera.ru`, delete, NS, MX, TXT, SRV, CAA или DNSSEC mutation делает
plan недействительным.

Для полноценного GeoDNS отдельный provider-plan должен пройти те же gates и
сравнить staging zone с Cloudflare snapshot. Никакая часть runbook не разрешает
ручную смену NS до готового provider rollback.

## 6. Emergency DNS-only apply

Этот шаг предназначен только для подтверждённого outage и только после всех
gates. Он меняет proxy flag точного набора публичных GitHub Pages records и не
касается admin или содержимого записей:

```powershell
node scripts/cloudflare/manage-ru-connectivity.mjs apply-direct `
  --expected-main-sha=0123456789abcdef0123456789abcdef01234567 `
  --pages-hostname=Kosyat128.github.io `
  --delivery-plan=config/dns/ru-connectivity-plan.json `
  --tls-proof=artifacts/direct-proof-bound.json `
  --snapshot=artifacts/probpera-dns-before.json `
  --confirm="APPLY DIRECT PROBPERA 0123456789abcdef0123456789abcdef01234567"
```

Скрипт повторно читает зону до и после PATCH, отказывается при drift и меняет
только `proxied: true` на `false` у доказанных public Pages records. Он не
создаёт, не удаляет и не переименовывает записи. Это временно отправляет весь
мир direct, а не реализует RU split.

Cloudflare batch атомарен в своей БД, но распространение отдельных DNS records
по edge не атомарно. Поэтому post-apply ждёт resolver quorum для A и AAAA, а при
любом mixed/stale состоянии выполняет compensating rollback из того же snapshot.

На текущем состоянии workflow обязан остановиться ещё до PATCH: committed plan
имеет `status=blocked` и `productionRoutingState=cloudflare-full`, Pages DNS
check/HTTPS renewal не доказаны, а direct TLS proof получает hostname mismatch.
Ни один из этих отказов нельзя обходить confirmation-строкой.

Каждый `apply-direct` attempt после snapshot capture публикует отдельный
зашифрованный apply-only snapshot. При rollback workflow аттестует именно этот
completed run и допускает failure/cancel/timeout после mutation, потому что это
главные случаи аварийного отката. Подлинность envelope, embedded topology и
drift всё равно проверяются fail-closed. SHA snapshot/apply `A` передаётся как
`--snapshot-main-sha`, а текущий повторно
reviewed SHA `main` `B` — как `--expected-main-sha` и в confirmation. Это
сохраняет возможность отката после продвижения `main`, не позволяя оператору
подменить provenance snapshot. Полная команда приведена в
`docs/RU_CONNECTIVITY_ROLLBACK.md`.

## 7. GeoDNS production migration

Миграция разрешена только в reviewed maintenance window:

1. Зафиксировать Cloudflare, registrar, provider и direct proof snapshots.
2. Проверить отсутствие DS у регистратора непосредственно перед сменой NS.
3. Активировать Advanced Certificate; доказать SAN/status и delegated DCV.
4. Подготовить staging zone с exact Partial targets для apex/`www`/admin и
   rollback version, направляющей все три имени через Cloudflare.
5. Конвертировать Cloudflare full zone в Partial только после cert gate,
   сохранить `verification_key` и опубликовать постоянный verification TXT.
6. Проверить через staging apex/`www`, а также admin Worker TLS/login/security.
7. Применить provider candidate атомарно и сменить authoritative NS одной
   транзакцией registrar API.
8. Не удалять Cloudflare zone, Advanced Certificate или rollback version.
9. Проверять старые и новые authoritative NS в течение propagation.
10. В том же reviewed rollout переключить plan marker на
   `productionRoutingState=geodns-ru-direct`: post-deploy и scheduled RU probes
   тогда требуют direct route, а не прежний Cloudflare route.
11. После подтверждения стабильности подписать новую зону и добавить новый DS
   отдельным контролируемым изменением; не публиковать DS заранее.

Для отката маршрута после делегирования внешнему GeoDNS **не надо ждать возврата
NS**: одной provider API-операцией активируется rollback policy, направляющая
RU и DEFAULT на Cloudflare Partial. Возврат NS Cloudflare выполняется только
как отдельная долгосрочная миграция.

## 8. Проверка после apply

Проверить минимум:

| Сегмент | Обязательные проверки |
| --- | --- |
| Global | root, sitemap, robots, RSS, security.txt, крупные статьи/assets, release SHA, headers |
| RU IPv4 auto | минимум 5 RU eyeball probes: root HTTPS/TLS/≤5s, ожидаемый route и exact release-head SHA |
| RU IPv6 auto | минимум 3 RU eyeball probes с теми же route/SNI/release проверками |
| RU final ISP | Москва, Санкт-Петербург, мобильный ASN и фиксированный ISP; полный HTML/assets/PWA/CMS fetch и content parity |
| Direct | каждый A/AAAA, root + body >16 KiB endpoint, JS/CSS/image/PWA/CMS |
| SEO | canonical, OG, JSON-LD, sitemap, robots, 404, выборка legacy aliases; одинаковый content hash |
| Admin | emergency: прежний fingerprint; GeoDNS: exact admin Partial target, Worker TLS, `/` → `/dashboard` → `/login`, security headers |

Автоматическая российская probe запускается через Globalping как строгий
root/release route signal: неполная выборка, один timeout/TLS/status/route/
release mismatch или ответ дольше 5 секунд делает её failed/inconclusive. Она
не доказывает полную asset parity и не превращается в `confirmed`. Итог
`confirmed` допустим лишь после Москвы, Санкт-Петербурга, хотя бы одного
мобильного и одного фиксированного ASN на production GeoDNS.

Emergency apply запускает эту RU probe непосредственно после DNS/direct/admin
проверок; её failure входит в compensating rollback. Текущий probe честно
помечает `fullAssetParityVerified=false` и `requires_final_isp_test`, поэтому
emergency workflow не сохраняет DNS mutation: он компенсирует её, пока не
появится отдельно аттестованный final-ISP/full-asset adapter. Успешный Pages
deploy также запускает новую RU probe через `workflow_run`, а ежедневный запуск
берёт ожидаемый route из reviewed `productionRoutingState`.

Немедленно откатывать при TLS error, SERVFAIL, несовпадении release SHA,
разных IPv4/IPv6 routes, plaintext HTTP, деградации admin или изменении
canonical/content.

## 9. Секреты и логи

- Не передавать API tokens аргументами CLI.
- Не печатать account/zone/record IDs и record contents.
- Никогда не загружать raw snapshot в Actions artifact: только AES-256-GCM
  envelope. Disposable read-only artifact хранится два дня, а apply-only
  rollback artifact — 90 дней; ключ с его `keyId` нельзя удалять из keyring до
  истечения этого срока. Environment reviewers не ограничивают скачивание
  artifact сами по себе.
- Provider token ограничить одной зоной и операциями read/write records/version;
  registrar token не использовать в обычном monitoring workflow.
- Никогда не добавлять Supabase service-role key в DNS workflows.

Откат описан в [`RU_CONNECTIVITY_ROLLBACK.md`](./RU_CONNECTIVITY_ROLLBACK.md),
а обоснование архитектуры — в
[`RU_CONNECTIVITY_ARCHITECTURE.md`](./RU_CONNECTIVITY_ARCHITECTURE.md).
