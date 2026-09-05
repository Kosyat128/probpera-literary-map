# SITE CANON CONTRACT

## Высший инвариант

Приложение является клиентом и расширением готовой «Литературной
планеты» на сайте, а не её параллельной имитацией.

## Канонические области

### Globe

- существующий `LiteraryGlobe`;
- существующий `GlobeCameraRig`;
- geography/projection/picking;
- country/writer focus;
- edition registry;
- textures/materials/lighting;
- `MuseumSkyDome`;
- `MuseumStarfield`;
- один Canvas и один renderer;
- текущие performance policies.

### Content

- Country IDs;
- Writer IDs;
- Work/Book IDs;
- coordinates;
- verified biographies;
- genres/tags;
- Nobel data;
- editorial sources;
- canonical article routes.

### Assets

- official brand logo;
- site brand tokens;
- rights-approved writer portraits;
- canonical country flags;
- owner-supplied/rights-approved covers;
- globe source/provenance;
- approved fonts.

### Editorial control

- existing CMS/admin;
- existing publication workflow;
- existing provenance/rights audits;
- existing translation status;
- existing release gates.

## Разрешённые platform-only данные

- native app preferences;
- offline package metadata;
- child profiles;
- exact age policy metadata;
- Parent Gate state;
- Планетка scripts;
- customization catalog;
- store SKU mappings;
- entitlements;
- platform collections;
- device graphics tier.

Они не могут переопределять facts канонической базы.

## Shared-kernel direction

```
canonical literary/globe/content/brand kernel
          ├── web/site client
          ├── web/PWA app client
          ├── Android client
          └── iOS/iPadOS client
```

Native SDK imports разрешены только в platform adapters.

## Паритетные проверки

Обязательные автоматические сравнения:

- stable IDs;
- coordinates;
- country count/identity;
- writer identity;
- work identity;
- edition registry;
- texture source/checksum;
- globe orientation correction;
- picking result;
- camera semantic intent;
- portrait asset/provenance;
- flag asset;
- verified biography hash;
- locale strings;
- article canonical URL.

## Visual parity capture

Для одного deterministic state:

- web site desktop;
- web site mobile viewport;
- PWA;
- Android;
- iOS simulator.

Фиксировать locale, edition, selected country, selected writer, camera
intent, auto rotation off, reduced motion, deterministic stars и viewport.

Chrome/layout могут быть platform-adaptive. География, surface, data,
portrait, flag и semantic selection обязаны совпадать.

## P0 нарушения

- второй globe engine;
- отдельная ручная platform database;
- app-only biography correction;
- generated real-person portrait;
- fake flag;
- screenshot globe вместо runtime;
- remote site WebView как app;
- изменение author article text;
- web import native SDK;
- platform geographic divergence;
- отсутствие автоматического content export из canonical source.

Любое P0 блокирует release.
