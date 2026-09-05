# Shared canonical product / Общая каноническая основа

S02 connects platform capabilities and narrow domain entry points to the existing
site. The canonical sources remain in place, with their original identities,
publication gates, assets, UI, locale provider and scene ownership.

| Entry point | Existing responsibility and loading boundary |
| --- | --- |
| `src/planet/types.ts` | Type-only canonical countries, writers, works, evidence and translation profiles |
| `src/planet/catalog.ts` | Original public countries and book-source view; App imports it only after the existing demand gate |
| `src/planet/editorialCatalog.ts` | Original editorial/recovery views; excluded from the public App entry |
| `src/planet/books.ts` | Original archive builders, keys, publication gates and queue presentation; loaded through the existing cached runtime promise |
| `src/planet/selection.ts` | Original locale selectors, coordinates, discovery and pure atlas state helpers; no catalog/Three evaluation |
| `src/planet/editions.ts` | Original globe editions and texture URL selection; no textures or renderer created |
| `src/planet/brand.ts` | Original icons, canonical flag paths and existing CSS; App consumes the same components |
| `src/planet/localization.ts` | Original locale provider, hooks, translation/plural functions and typed translation profiles; no second locale state |

There is no aggregate index barrel: a simple icon or locale import must not pull
in the full editorial/book/3D graph. Direct type-only imports remain valid.
The public book loader still shares one in-flight/result promise and resets it
after a rejected import. Quarantined records cannot become public through a
facade, and CMS tombstones still preserve the separate editorial recovery view.

RU: Общие точки входа возвращают исходные объекты, функции и ресурсы сайта.
Они не копируют каталог и не создают новую схему идентификаторов. Каталоги книг
и стран сохраняют отложенную загрузку; редакционные представления отделены от
публичных. Исходные портреты, флаги, глобус и книжная сцена сохранены.

## Platform capabilities / Возможности платформы

`src/platform/ports.ts` defines platform identity, connection/visibility snapshots,
system language preferences, non-secret preferences and external link results.
It imports no SDK and owns no country, writer, work, locale, scene, child,
download or entitlement state. Later routed stages extend these contracts with
real purchase, filesystem and native implementations.

`PlatformServicesProvider` injects one adapter instance for the mounted product.
It adds no DOM wrapper or locale key and rejects instance replacement. Server
rendering uses a stable unknown/active snapshot without accessing browser APIs.
The Web root creates its adapter once after the canonical safe-storage setup,
then retains the existing Language/Auth/provider order inside the bootstrap
error boundary. CMS edit-mode guards for service workers, analytics and tracking
remain intact.

The Web adapter starts online/offline/visibility listeners with its first
subscriber and removes them with its last subscriber. Snapshots are immutable
and referentially stable until a value changes. ConnectivityStatus consumes
this port while retaining its original translated offline/update messages.
Unknown network status is not proof of connectivity or payment availability.

Preferences accept only the two existing language/display-mode keys and their
canonical values. Writes/removals are checked by reading back the result. The
existing storage fallback is explicitly best-effort; it is never durable secure
storage or entitlement evidence. Language preferences come only from the
navigator, without geographic or store-country inference.

External links accept HTTPS without credentials or control characters. They
request one browser opening with `noopener,noreferrer`. A null browser result
is reported as `requested`: it cannot prove success or popup blocking. No
second opening is attempted.

RU: Платформенный адаптер имеет один экземпляр и не владеет состоянием глобуса
или языка. Проверки сети и настроек не выдают неподтверждённый успех. Доступ
к native SDK появится только в соответствующих адаптерах на своих этапах.

## Acceptance scope / Границы приёмки

S02 verifies extraction and integration. The existing TypeScript locale and
translation profile types are shared; strict message IDs, ICU validation,
complete RU/EN content and editorial acceptance remain required at their
localization stages. This extraction does not certify the existing fallback
behavior as a finished English production experience.

Static ownership and browser DOM Canvas identity are distinct checks. Actual
renderer/camera object identity, native lifecycle/device tests, child profiles,
entitlements, downloads and exact-RC evidence remain later requirements.
No owner visual/content fingerprint is recalculated to accept this change.
