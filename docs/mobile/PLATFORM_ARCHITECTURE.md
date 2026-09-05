# Canonical platform architecture / Каноническая архитектура платформ

S01 source contract, inspected against canonical main
`0a348bd4202e3fa1558d88183549f7576a361c4b`. This document describes existing
ownership and the boundary for subsequent implementation. It does not claim
that native projects, offline packages or purchase providers already exist.
Binding stage input: `requirements/v12/07_THREE_PLATFORM_ARCHITECTURE_RU.md`.

## Existing shared product / Существующий общий продукт

| Responsibility / Область | Canonical source / Канонический источник |
| --- | --- |
| Browser root and providers | `src/main.tsx` |
| Product composition and country/writer/work selection | `src/App.tsx` |
| Globe loading and presentation | `src/components/LiteraryWorldMap.tsx` |
| Globe scene and its R3F Canvas | `src/components/LiteraryGlobe.tsx` |
| Globe camera behavior | `src/components/GlobeCameraRig.tsx` |
| Atlas transitions, panels and history | `src/atlas/atlasExperienceState.ts`, `src/atlas/useAtlasExperience.ts` |
| Canonical URL selection | `src/utils/atlasUrlState.ts` |
| Interface language context | `src/i18n/InterfaceLanguage.tsx` |
| Existing catalog and CMS-derived records | `src/data/` and their existing loaders |
| Existing independent bookshelf scene | `src/components/BookShelfSceneCanvas.tsx`, loaded by `src/components/BookShelfScene.tsx` |

Web/PWA, Android and iOS/iPadOS reuse this product and its stable catalog IDs.
Locale is presentation state. Selecting Russian or English must preserve the
same LiteraryGlobe instance, globe Canvas, renderer, camera, country, writer,
work, navigation, child profile, entitlements and downloads. Do not key the
product or scene by locale, create a parallel translated database, or substitute
an independently implemented native globe. Shared content/provenance, child
policy, entitlement model and package schemas belong to the shared domain.

RU: Все платформы используют существующий продукт и те же идентификаторы
каталога. Язык меняет представление; он не пересоздаёт сцену, состояние выбора,
профиль ребёнка, покупки или загрузки. Второй глобус и отдельная переводная
база запрещены.

The canonical site already owns a separate bookshelf Canvas. Its exact file is
preserved as an explicit ownership exception; it is not a second globe.
The two allowed Canvas files are exactly the two table entries above. This is
not a wildcard allowance for additional scenes. Source ownership cannot prove
that only one globe Canvas is active or that scene identity survives a locale
change. Browser and native runtime tests remain required.

RU: Отдельная книжная сцена уже есть в каноническом main. Сохраняется только её
точный путь. Статическая проверка владельцев Canvas не заменяет проверку
активного экземпляра глобуса и renderer в браузере и на устройствах.

## Adapter boundary / Граница адаптеров

The following are reserved locations for subsequent implementation, not newly
created product sources in S01:

| Proposed location / Планируемый путь | Contract / Контракт |
| --- | --- |
| `src/platform/ports.ts` | Shared capability, lifecycle, storage, link, download and purchase types; no SDK imports |
| `src/platform/PlatformServices.tsx` | Shared dependency injection for platform capabilities; no native module loading |
| `src/platform/adapters/web/` | WebPlatformAdapter and WebPurchaseProvider using browser APIs |
| `src/platform/adapters/android/` | Android lifecycle/storage/link bridge and isolated `dev`, `googlePlay`, `ruStore` providers |
| `src/platform/adapters/ios/` | iOS/iPadOS bridge and StoreKit provider |

Native SDK imports, including type imports, belong only in the two exact native
adapter roots. Web imports shared contracts and web implementations. An
`if (native)` condition around a native dynamic import in shared code still
introduces a forbidden Web dependency. A future native entry may live inside
its corresponding adapter root and inject services into the same product;
it must not copy App, catalog, locale state or scene implementations. Extract
existing root/provider composition into a shared neutral component only when
needed, preserving the canonical provider lifetime.

Native platform projects and build outputs will be separate artifacts.
Capacitor must use a static local `webDir` containing the bundled canonical
runtime. `server.url`, permissive `allowNavigation`, executable update plugins
and remote module loading are rejected. Permitted versioned content downloads
are data packages, governed by the shared integrity/rights contract, not
downloaded JavaScript. Native API/network requests do not change this rule.
Keep the PWA service-worker scope isolated from the canonical site's caches.

RU: Native SDK доступны только через Android/iOS адаптеры. Условный import
в общем коде не является изоляцией. В native binary включается локальный
runtime того же продукта. Платформенные покупки возвращают общий контракт
состояния; Google Play и RuStore имеют разные реализации и конфигурацию.
Русский и английский равноправны для общего интерфейса и native strings.

## Executable source guard / Исполняемая проверка

Run from repository root:

```sh
node scripts/mobile/platform-boundaries.mjs
node node_modules/vitest/vitest.mjs run scripts/mobile/platform-boundaries.test.mjs
```

The CLI prints JSON and exits `0` for pass, `1` for policy findings, `2` for
invalid invocation/audit setup. `--root=`, repeatable `--entry=` and
`--source=` override audited paths. The exported
`runPlatformBoundaryAudit(options)` also accepts exact `adapterRoots`,
`canonicalSceneFiles`, `canvasOwnerFiles`, `nativeConfigFiles`, `moduleAliases`
and TypeScript `compilerOptions` for fixtures or a future build layout.
Explicitly include every future application root, entry and native config.

The guard uses the installed TypeScript parser and resolver without executing
application code or Capacitor config. It follows static imports, re-exports,
literal dynamic imports, CommonJS references, TypeScript aliases and literal
Vite globs. It recognizes native package families and npm package aliases,
native provider paths, direct/aliased/namespace R3F Canvas creation,
React/JSX factory calls, manual R3F roots and Three renderer construction.
Package classification normalizes query/hash suffixes. Namespace provenance
survives local aliases, destructuring and re-export barrels; lexical scopes
keep unrelated local names from overwriting Canvas bindings. Three renderer
subpaths are included. Native config rejects prototype declarations that
could otherwise hide inherited runtime settings.
It rejects unresolved runtime edges, computed loaders, known executable loader
aliases and non-static or mutated native config.

Dependency resolution failures are enforced on the reachable Web graph and
the independently audited native-adapter graph. Inactive historical source
is still scanned for SDK placement and duplicate scene ownership, but its
unreachable imports are not claimed as bundled dependencies. Test helpers and
declarations are excluded from discovery; importing a helper into runtime
makes it subject to the runtime gate. Type-only edges do not enter a browser
bundle, while their native SDK placement remains restricted.

This guard is an early source gate, not a general JavaScript data-flow or
supply-chain proof. Installed dependency contents, bundler plugins, injected
scripts, generated bundles/native binaries, CSP and package integrity require
separate artifact checks. Dynamic factory/reflection patterns beyond the
recognized AST forms require explicit review. RC acceptance must measure
actual scene identity, locale parity, platform behavior and packaged assets.
