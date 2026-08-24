# Rollback российского маршрута `probpera.ru`

Production DNS на момент создания документа не изменён. Этот документ задаёт
обязательный откат для двух будущих операций:

1. временное переключение точных public GitHub Pages records из Cloudflare
   `proxied` в DNS-only;
2. активация RU/DEFAULT policy во внешнем authoritative GeoDNS.

Удаление зоны, ручное восстановление записей по этому документу, force push,
смена canonical и изменение `admin.probpera.ru` не являются rollback.

## Необходимый snapshot

Перед **каждым** apply создать новый snapshot из того же актуального состояния:

```powershell
node scripts/cloudflare/manage-ru-connectivity.mjs snapshot `
  --snapshot=artifacts/probpera-dns-before.json `
  --expected-main-sha=0123456789abcdef0123456789abcdef01234567
```

Файл должен содержать:

- zone identity и время чтения;
- все страницы A, AAAA, CNAME, CAA, MX, TXT и SRV;
- record IDs, имена, значения, TTL, priority и proxy flags, необходимые API
  для точного восстановления;
- DNSSEC state;
- fingerprint `admin.probpera.ru`;
- SHA/версию схемы snapshot.

Record contents/IDs не печатаются в stdout и не коммитятся. Raw snapshot не
загружается в GitHub Actions. Он шифруется AES-256-GCM. Disposable read-only
envelope хранится два дня, а apply-only rollback envelope — 90 дней:

```powershell
node scripts/cloudflare/protect-ru-snapshot.mjs encrypt `
  --input=artifacts/probpera-dns-before.json `
  --output=artifacts/probpera-dns-before.enc.json
```

Перед rollback envelope расшифровывается на ephemeral runner той же командой с
`decrypt`. Для любого apply artifact обязателен отдельный versioned keyring
`RU_CONNECTIVITY_SNAPSHOT_KEYRING_JSON`. Envelope аутентифицирует `keyId`;
ротация добавляет новый active key, но не удаляет предыдущий минимум 90 дней.
Так один keyring продолжает расшифровывать snapshot A после перехода на key B.
HKDF из `CLOUDFLARE_API_TOKEN` разрешён только для disposable read-only snapshots
и никогда не является mutation/rollback контрактом. Apply
запрещён, если snapshot создан после mutation, относится к другой зоне,
неполон, устарел или не проходит integrity validation.

Наблюдаемые публичные Cloudflare IP не являются snapshot origin records и
никогда не используются для восстановления.

## Одно действие: откат emergency DNS-only

Rollback различает два неизменяемых SHA:

- `A` — SHA исходного `apply-direct` attempt, встроенный в snapshot;
- `B` — текущий повторно reviewed SHA `main`, код которого выполняет rollback.

Production workflow получает `A` только из аттестованного completed apply run
с отдельным apply-only artifact;
пользовательский ввод для этого значения не принимается. Confirmation и remote
`main` gate всегда относятся к текущему `B`. Поэтому продвижение `main` после
apply не делает аварийный откат невозможным:

```powershell
node scripts/cloudflare/manage-ru-connectivity.mjs rollback `
  --snapshot=artifacts/probpera-dns-before.json `
  --expected-main-sha=2222222222222222222222222222222222222222 `
  --snapshot-main-sha=1111111111111111111111111111111111111111 `
  --pages-hostname=Kosyat128.github.io `
  --confirm="ROLLBACK PROBPERA 2222222222222222222222222222222222222222"
```

Это одна CLI/API apply-операция для оператора. Скрипт:

1. повторно находит ровно одну активную зону `probpera.ru` в разрешённом
   account;
2. сравнивает текущее состояние с допустимым post-apply drift;
3. восстанавливает только поля точных records, изменённых apply-direct;
4. не создаёт и не удаляет записи, не меняет NS/DNSSEC и не касается admin;
5. повторно читает все изменённые records и требует точного совпадения со
   snapshot;
6. отдельно подтверждает неизменность fingerprint admin.

Команда идемпотентна: повтор после network/API interruption должен либо
подтвердить уже восстановленное состояние, либо завершиться fail-closed с
перечнем категорий drift без вывода record contents.

Сам `apply-direct` также компенсируется: после неоднозначного timeout manager
повторно читает control-plane, восстанавливает любой наблюдаемый subset точных
proxy changes и дважды сравнивает состояние со snapshot. Workflow запускает ту
же rollback-команду при отказе manager/direct/admin/RU-eyeball/final-ISP
postcheck, затем требует Cloudflare DNS quorum A+AAAA и live security smoke.
Пока final-ISP adapter не реализован, Globalping отчёт намеренно не считается
полным подтверждением и mutation компенсируется. Failed apply остаётся
красным даже после успешного восстановления. Apply-only encrypted artifact
сохраняется как независимый ручной fallback.

Компенсация гарантируется для обычного failure шага; job-level `always()`
оставляет cleanup eligible и при штатной отмене workflow. Hard timeout, потеря
runner или сбой самой Actions control plane всё равно могут остановить процесс;
в таком случае нельзя считать rollback автоматически выполненным — используется
90-дневный apply-only artifact и отдельный ручной rollback run.

После отката ожидать до текущего routing TTL (наблюдалось 300 секунд) плюс
cache resolver. Cloudflare proxy может стать доступен раньше, но проверка не
считается завершённой до обновления нескольких recursive resolvers.

## Одно действие: откат GeoDNS route

Смена authoritative NS сама по себе медленная и не является оперативным
rollback. Поэтому внешний GeoDNS нельзя делегировать, пока provider не хранит
две immutable версии:

```text
candidate: RU -> direct, DEFAULT -> Cloudflare Partial, ADMIN -> admin Partial
rollback:  RU -> Cloudflare Partial, DEFAULT -> Cloudflare Partial, ADMIN -> admin Partial
```

Оперативный откат — одна авторизованная provider API-команда активации версии
`rollback`. Она оставляет новые NS authoritative, но немедленно прекращает RU
direct routing. Точная команда и provider version ID генерируются staging
workflow после появления provider account; placeholder или ручное
редактирование record sets запрещены.

Rollback policy сохраняет Cloudflare zone в Partial mode, Advanced Certificate,
delegated DCV, verification TXT и exact Partial target admin. Он не пытается
сразу вернуть full mode: обратная conversion имеет отдельные certificate/NS
риски и не является аварийным действием.

Возврат NS на Cloudflare выполняется позже как плановая миграция только после
проверки Cloudflare zone snapshot. Он не заменяет оперативный route rollback.

## DNSSEC при откате

На 24 августа 2026 года DS у `.ru` отсутствует, зона unsigned. Это состояние
надо подтвердить непосредственно перед NS migration.

Если после GeoDNS migration DNSSEC уже включён:

1. при обычном route rollback не менять DNSKEY/DS — authoritative provider тот
   же;
2. перед возвратом NS удалить/заменить DS в последовательности, указанной
   обоими providers, дождаться expiry старых подписей/TTL и только затем менять
   делегирование;
3. не публиковать Cloudflare DS при внешних NS и не оставлять внешний DS после
   возврата — это вызовет SERVFAIL.

DNSSEC mutation никогда не входит в emergency rollback script.

## Триггеры немедленного отката

Откатывать без ожидания при любом из условий:

- certificate/SNI/hostname error;
- HTTP direct отвечает plaintext вместо permanent HTTPS redirect;
- SERVFAIL/NXDOMAIN или разные policy для A и AAAA;
- RU route всё ещё возвращает Cloudflare IP/headers;
- DEFAULT перестал возвращать Cloudflare Partial route;
- release SHA или content hash различается между route;
- sitemap/robots/RSS/PWA/assets/статья/legacy alias не доступны;
- canonical/OG/JSON-LD различаются по стране;
- `admin.probpera.ru` DNS fingerprint, login redirects или security headers
  изменились;
- возникло неописанное изменение MX/TXT/CAA/SRV/NS/DNSSEC.

## Проверка после rollback

Выполнить:

```powershell
npm run connectivity:audit -- --mode=global --host=probpera.ru `
  --expected-dns-route=cloudflare --dns-attempts=6 `
  --dns-retry-delay-ms=15000 --json
npm run release:smoke:live -- --attempts=6 --retry-delay-ms=15000
node scripts/cloudflare/manage-ru-connectivity.mjs inspect
```

Затем проверить через `1.1.1.1`, `8.8.8.8`, `9.9.9.9`:

- apex и `www` возвращаются на Cloudflare для A и AAAA;
- HTTP/HTTPS redirect chain восстановлен;
- global release SHA совпадает с deployed `main`;
- Cloudflare security headers снова присутствуют;
- admin по-прежнему ведёт `/` → `/dashboard` → `/login`.

Для российского результата выполнить новые, а не переиспользовать старые,
пробы из Москвы, Санкт-Петербурга, мобильного и фиксированного ASN. В отчёте
указать measurement IDs и отдельно отметить IPv4/IPv6.

## Если автоматический rollback отказал

Не удалять записи и не менять их по памяти. Сохранить redacted error summary,
запустить `inspect`, скачать исходный зашифрованный snapshot artifact,
расшифровать его только внутри защищённого production job и повторить ту же
идемпотентную rollback-команду. Если drift не относится к управляемым public
records, остановиться: требуется reviewed reconcile plan. `admin`, NS, DNSSEC,
MX/TXT/CAA/SRV остаются запрещённой областью даже во время инцидента.
