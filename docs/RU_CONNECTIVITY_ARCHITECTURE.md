# Доступность `probpera.ru` из российских сетей

Статус на 24 августа 2026 года: **production DNS не изменён**. Прямой
GitHub Pages origin отдаёт правильную публикацию, но пока не имеет сертификата
для `probpera.ru`. Переключение публичной записи в DNS-only в таком состоянии
создаст ошибку HTTPS и оставит HTTP без обязательного redirect, поэтому оно
заблокировано автоматическими preflight-проверками.

## Подтверждённое состояние

Репозиторий и публикация:

- `main`: `98f1aa7c1a8db5bea22d4a49bc2b26808f8b066e`;
- последний Pages deploy `32695063596` и deployment `6057344831` успешны;
- опубликованный `/.well-known/probpera-release-head.json` содержит тот же SHA;
- Pages artifact содержит `CNAME` со значением `probpera.ru`;
- в Pages выбран GitHub Actions и custom domain `probpera.ru`, но DNS check ещё
  имеет статус `in progress`, а `Enforce HTTPS` недоступен;
- `admin.probpera.ru` является отдельным приложением за Cloudflare и не входит
  в область emergency DNS-only изменения публичного сайта. При будущей смене
  authoritative NS его приложение остаётся неизменным, но внешний DNS обязан
  явно сохранить Cloudflare route через Partial CNAME target.

Наблюдаемая DNS-картина через системный resolver, `1.1.1.1`, `8.8.8.8` и
`9.9.9.9`:

| Имя | Наблюдаемый маршрут | TTL | Остальные факты |
| --- | --- | ---: | --- |
| `probpera.ru` | Cloudflare A и AAAA | 300 | authoritative NS: `magdalena.ns.cloudflare.com`, `miguel.ns.cloudflare.com`; TXT Google verification; CAA нет |
| `www.probpera.ru` | Cloudflare A и AAAA | 300 | CNAME скрыт proxy/flattening; HTTP/HTTPS ведёт на apex |
| `admin.probpera.ru` | Cloudflare A и AAAA | 300 | отдельный Worker/Next route; менять запрещено |

Публичные ответы содержат `Server: cloudflare` и `CF-Ray`, поэтому эффективный
proxy-статус всех трёх имён подтверждён независимо от скрытого origin record.
Точный тип, значение, ID и флаг каждой записи должны браться только из
Cloudflare API snapshot; публичный DNS не позволяет безопасно восстановить эти
метаданные. Snapshot-инструмент намеренно не делает предположений.

У `probpera.ru` сейчас нет DS в родительской зоне `.ru`, а child-зона не
подписана. Следовательно, DNSSEC сейчас выключен и SERVFAIL из-за устаревшего DS
не является причиной инцидента. Перед будущим включением DNSSEC всё равно нужен
отдельный preflight у регистратора.

## HTTP, TLS и origin

Текущий global route работает так:

```text
HTTP probpera.ru ──308──> HTTPS probpera.ru ──Cloudflare──> GitHub Pages
HTTP www          ──301──> HTTPS www ──301──> HTTPS probpera.ru
admin.probpera.ru ─────────────────────Cloudflare Worker/Next (без изменений)
```

Датированными read-only пробами 24 августа 2026 года на публичном route
подтверждены TLS, IPv4, IPv6, HSTS, CSP, `X-Content-Type-Options`, строгий
`Referrer-Policy`, `Permissions-Policy` и COOP. Отдельные ручные protocol-пробы
наблюдали HTTP/1.1, HTTP/2 и HTTP/3, а также Cloudflare response/cache headers;
основной Node-аудит использует HTTP/1.1 и не выдаёт эти наблюдения за свой
автоматический apply gate. Их надо повторять клиентами с явными
`--http1.1`/`--http2`/`--http3-only` перед production migration.
Отключение HTTP/3 не устраняет зависимость TCP/TLS от Cloudflare и поэтому не
рассматривается как исправление.

Официальные адреса GitHub Pages сверены с документацией GitHub:

```text
185.199.108.153                 2606:50c0:8000::153
185.199.109.153                 2606:50c0:8001::153
185.199.110.153                 2606:50c0:8002::153
185.199.111.153                 2606:50c0:8003::153
```

Все четыре IPv4 origin отдают с `Host: probpera.ru` ту же главную страницу,
release metadata, sitemap, robots, RSS, service worker, manifest, JS, CSS,
изображения, CMS snapshot и статьи. Однако при корректном SNI
`probpera.ru` origin предъявляет сертификат `*.github.io`; проверка имени
заканчивается `ERR_TLS_CERT_ALTNAME_INVALID`. На port 80 origin возвращает
`200`, а не redirect на HTTPS. Это два независимых fail-closed блокера
аварийного DNS-only переключения.

Внешняя dual-stack проверка Globalping `2u26Q3vdN2fFsEBO6000210Pv`
принудительно подключилась к `2606:50c0:8000::153` с Host/SNI
`probpera.ru` и обязательным HTTP/2. Она получила правильный release SHA и
HTTP 200, но `tls.authorized=false` с тем же
`ERR_TLS_CERT_ALTNAME_INVALID`. Это подтверждает блокер и на IPv6 независимо
от отсутствия outbound IPv6 у GitHub-hosted runner.

## Что показали российские пробы

24 августа 2026 года выполнены внешние Globalping-пробы из российских
eyeball-сетей:

- `2mdent8iVYDxBju2T000210Ov`: 10/10 ответов HTTPS 200; один ответ из
  Владивостока занял около 25 секунд;
- `2DVnYRfqyh03TBmdq000210Ow`: 20/20 IPv4 ответов HTTPS 200, включая МТС,
  Ростелеком и ER-Telecom;
- `2OPvADM8GINroqP0i000210Ow`: 4/4 IPv6 ответов HTTPS 200, включая Ростелеком
  и ER-Telecom.

Эта выборка опровергает только постоянную общероссийскую блокировку. Она не
опровергает выборочную или периодическую деградацию Cloudflare у конкретных
мобильных ASN/регионов; один 25-секундный ответ совместим с таким сценарием.
Точную ISP-причину пользовательского случая без пробы в пострадавшей сети
установить нельзя. Точная архитектурная причина отсутствия обхода установлена:
сейчас каждый публичный клиент, включая RU, обязан сначала установить соединение
с Cloudflare.

## Почему Cloudflare Worker и Cloudflare Load Balancer не решают задачу

Worker, Redirect/Transform/WAF/Page Rule получают управление только после
успешного соединения клиента с Cloudflare. Они не являются pre-edge обходом.

У Cloudflare Load Balancer режим `Proxied` также сначала принимает соединение
на Cloudflare. Режим `DNS-only` может учитывать country/ECS, но proxy-статус
применяется к hostname целиком: один и тот же `probpera.ru` нельзя надёжно
выдать RU как gray-cloud, а остальному миру как orange-cloud. Смешивание A/AAAA
с разными proxy-флагами для одного имени Cloudflare тоже не создаёт такой split.

## Целевая схема

Технически корректный вариант сохраняет один URL и принимает решение до TCP/TLS:

```text
                         ┌─ RU/ECS ──────> custom-cert direct edge/origin
resolver ─> external     │                 A + AAAA, тот же artifact/SHA
           authoritative ┤
           GeoDNS        └─ DEFAULT ─────> Cloudflare Partial CNAME target
                                           CDN/WAF/cache ─> GitHub Pages

admin.probpera.ru ──все страны──────────> admin.probpera.ru.cdn.cloudflare.net
                                          └─ Cloudflare Worker/Next без смены app
```

GitHub Pages остаётся кандидатом direct origin только после доказанной
устойчивости не только первичной выдачи, но и **автоматического продления**
custom-domain сертификата при split DNS. GitHub требует, чтобы DNS custom
domain указывал на Pages; DEFAULT-ответ через Cloudflare Partial может снова
заблокировать DNS check/renewal. Разовая выдача сертификата после краткого
gray-cloud окна не является долгосрочным доказательством. Пока совместимость
renewal не подтверждена документацией/support **или** наблюдаемым контрольным
циклом, production
RU target должен быть другим edge/origin с custom certificate или DNS-01
renewal, не зависящим от географического ответа delivery hostname.

Для apex GeoDNS должен поддерживать ALIAS/ANAME flattening и country/ECS
filtering. IBM NS1 Connect является проверенным кандидатом: он документирует
ECS, country geofence, geographic filter chain и ALIAS на apex. Это не
автоматический выбор поставщика: коммерческий plan, SLA, API и фактические
российские resolver-пробы должны быть приняты до делегирования NS.

Default-ветка может сохранить Cloudflare только через Partial/CNAME setup.
Cloudflare документирует Partial setup как функцию Business/Enterprise; она
недоступна для домена у Cloudflare Registrar. Поэтому до миграции API-аудит
обязан подтвердить:

1. plan поддерживает Partial/CNAME setup;
2. registrar не блокирует Partial setup;
3. до full→partial conversion активирован Advanced Certificate, покрывающий
   apex, `www` и admin; Universal SSL при conversion удаляется;
4. delegated DCV и постоянный Cloudflare verification TXT подготовлены во
   внешней authoritative зоне;
5. созданы точные targets `probpera.ru.cdn.cloudflare.net`,
   `www.probpera.ru.cdn.cloudflare.net` и
   `admin.probpera.ru.cdn.cloudflare.net`;
6. admin Worker/custom-domain/TLS проверен через Partial target на staging;
7. внешний GeoDNS поддерживает атомарное применение и откат версии зоны.

Cloudflare требует Partial CNAME для **каждого** hostname, который остаётся
proxied. Поэтому «не трогать admin» означает не менять Worker, auth, cookies,
callbacks и policy, но не означает копировать старую full-zone запись: после
смены authoritative NS внешний provider обязан отвечать Partial target admin.
Без этого migration запрещена.

Если любое условие не выполняется, безопасный вариант B — тот же GeoDNS, но
default и RU ведут на два подготовленных delivery edge/origin с собственными
валидными сертификатами. До появления аккаунта и credentials такой edge нельзя
выбрать или объявить production-ready.

Generic `ru-connectivity-plan.json` намеренно не доверяет inline-полям ASN,
hostname или хэшам, которые можно написать вручную. Режим `custom-edge`
остаётся blocked, пока для выбранного provider не добавлен отдельный attested
adapter: он обязан независимо получить полную CNAME/A/AAAA chain, подтвердить
внешний ASN каждого адреса, исключить все Cloudflare ranges, проверить
certificate automation и связать результат с immutable artifact/SHA.

## Обязательные gates перед изменением DNS

Изменение блокируется, пока одновременно не выполнены все пункты:

- Cloudflare API snapshot содержит все страницы A/AAAA/CNAME/CAA/MX/TXT/SRV,
  TTL и proxy flags, плюс DNSSEC state;
- custom-domain DNS check GitHub Pages успешен и `Enforce HTTPS` включён;
- совместимость автоматического продления Pages certificate со split DNS
  подтверждена hash-bound redacted evidence-файлом из merged PR с независимым
  approve; обычный boolean/URL не является доказательством. Иначе выбран
  custom-cert-capable direct edge;
- сертификат прямого route покрывает `probpera.ru` и `www.probpera.ru` при
  корректном SNI на каждом A и AAAA;
- port 80 обоих публичных имён постоянно перенаправляет на тот же HTTPS URL;
- direct/global отдают одинаковый release SHA и содержимое;
- IPv4 и IPv6 GeoDNS-политики симметричны;
- apex, `www`, sitemap, robots, RSS, security.txt, PWA, assets, крупная статья,
  canonical, Open Graph, JSON-LD, 404 и legacy aliases прошли проверку;
- для emergency apply `admin.probpera.ru` имеет тот же DNS fingerprint; для
  GeoDNS migration он получает только точный admin Partial target и проходит
  Worker/custom-domain TLS, login redirect и security smoke-test;
- Advanced Certificate переживает full→partial conversion, delegated DCV и
  Cloudflare verification TXT подтверждены до смены NS;
- отсутствие DS у parent `.ru` повторно доказано непосредственно перед apply
  тестируемым DNS wire-format/HTTP2 probe через Cloudflare, Google и Quad9;
  unsigned candidate, registrar NS
  change и post-migration DNSSEC plan отдельно reviewed;
- есть сохранённый rollback snapshot и проверена одна команда отката;
- изменение относится к точному актуальному SHA `main` и прошло reviewed dry-run.

## Security на direct path

GitHub Pages не применяет Netlify/Cloudflare-файл `_headers`. Поэтому direct
route теряет edge HSTS, CSP, `nosniff`, COOP и другие Cloudflare response
headers. HTML содержит часть meta-политик, но meta-тег не эквивалентен всем
HTTP-заголовкам. Кроме того, Cloudflare WAF, rate limiting, bot protection и
cache rules не действуют на RU direct path.

Статический origin по-прежнему не раскрывает серверную БД или Supabase
service-role key, а canonical/content остаются одинаковыми. Если security
header parity является обязательной, direct GitHub Pages надо заменить на
другой доступный из РФ edge/origin, который поддерживает custom certificate и
response headers. Автоматизация не скрывает это ухудшение: emergency proof
fail-closed требует текущий критичный header contract, а GeoDNS plan отдельно
требует reviewed security policy direct edge. Обычная confirmation не является
waiver этих gates.

## SEO, cache и атомарность release

Если оба route используют Pages, они должны указывать на один Pages release.
Если RU использует custom-cert edge/origin, deploy обязан опубликовать тот же
immutable artifact на оба delivery path до активации DNS и сравнить
`/.well-known/probpera-release-head.json` и content hashes. GeoDNS меняет только
delivery path, но не контент: canonical остаётся `https://probpera.ru`, поэтому
разные сетевые ответы по стране не являются cloaking.

На direct route нельзя полагаться на Cloudflare redirects/cache rules. В
artifact уже существуют статические canonical-страницы и portable aliases:
это безопасный HTTP 200 fallback с `noindex`, canonical и meta-refresh, но не
server-side redirect. Все legacy aliases проверяются по build manifest;
production direct proof дополнительно требует живой 301/308, поэтому один
GitHub Pages artifact не может ложно считаться полным redirect-контрактом.
Default Cloudflare route сохраняет нынешний cache/security контракт.

## Первичные источники

- [GitHub Pages: custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [GitHub Pages: HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)
- [Cloudflare: Partial/CNAME setup](https://developers.cloudflare.com/dns/zone-setups/partial-setup/setup/)
- [Cloudflare: full-to-partial conversion](https://developers.cloudflare.com/dns/zone-setups/conversions/convert-full-to-partial/)
- [Cloudflare: DNS proxy status](https://developers.cloudflare.com/dns/proxy-status/)
- [Cloudflare Load Balancing proxy modes](https://developers.cloudflare.com/load-balancing/understand-basics/proxy-modes/)
- [Cloudflare geographic/ECS steering](https://developers.cloudflare.com/load-balancing/understand-basics/traffic-steering/steering-policies/)
- [IBM NS1: ECS](https://www.ibm.com/docs/en/ns1-connect?topic=overview-edns-client-subnet-ecs-extension)
- [IBM NS1: geographic filters](https://www.ibm.com/docs/en/ns1-connect?topic=filters-geographic)
- [IBM NS1: ALIAS records](https://www.ibm.com/docs/en/ns1-connect?topic=answers-comparing-cname-alias-linked-records)
