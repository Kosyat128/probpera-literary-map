# V12 — МАКСИМАЛЬНОЕ КАЧЕСТВО КАЖДОГО ЭЛЕМЕНТА

## 1. Правило

Фраза «максимально качественно» переводится в измеримый contract.
Абсолютно каждый пользовательский элемент проходит один и тот же
`Premium Element Gate`.

Нельзя закрыть Stage по наличию компонента. Компонент готов только когда
закрыты все десять измерений:

1. Product purpose и правильная иерархия.
2. Visual craft.
3. Полный interaction/state contract.
4. Responsive/adaptive behaviour.
5. Accessibility.
6. Performance/memory.
7. Offline/error/recovery.
8. Localization/microcopy.
9. Privacy/security/rights.
10. Tests и visual evidence.

## 2. Обязательные состояния

Для каждого применимого элемента:

- default;
- hover для web/pointer;
- focus-visible;
- pressed;
- selected;
- disabled;
- loading;
- success;
- empty;
- recoverable error;
- offline;
- unavailable;
- reduced motion;
- large text;
- high contrast;
- child mode;
- parent-gated.

## 3. Поэлементный список

### App icon и splash

- официальный знак;
- clean silhouette на маленьком размере;
- exact orange;
- no white/black flash;
- top-left branded bridge;
- no stretched asset;
- native platform compliance.

### Home

- globe-first;
- один dominant CTA;
- «Продолжить»;
- curated journey;
- clean hierarchy;
- магазин вторичен;
- no noisy carousel;
- быстрый meaningful frame.

### Navigation

- взрослый и child variants;
- Android Back;
- iOS gestures;
- tablet side rail;
- stable selection;
- safe areas;
- labels не обрезаются.

### Globe

- existing site canon;
- one Canvas;
- precision picking;
- camera ownership;
- fluid touch;
- no accidental selections;
- recovery;
- 60/30 FPS tiers;
- accessible list alternative.

### Markers, labels, flags

- real data;
- no overlap/clutter;
- readable at zoom levels;
- selected/hover hierarchy;
- backside non-interactive;
- real canonical SVG flags;
- screen-reader labels.

### Writer and Work cards

- real approved portrait/cover;
- stable aspect ratios;
- faceless placeholder when needed;
- clear metadata;
- typography without truncating essential names;
- source/provenance access;
- age label in child mode.

### Buttons

- one primary per screen;
- canonical orange;
- secondary violet;
- 44x44 minimum;
- loading preserves geometry;
- clear disabled reason;
- haptic only as additional feedback;
- no random gradients.

### Search

- instant but cancellable;
- typo/transliteration support;
- grouped results;
- child index separated before query response;
- offline search;
- recent queries controllable;
- no empty dead end.

### Reading surface

- paper/ivory themes;
- adjustable text;
- comfortable line length/height;
- progress/continue;
- bookmarks/favorites;
- no forced goals;
- offline.

### Планетка

- original character bible;
- clear silhouette;
- face rig quality;
- mouth below eyes;
- hands/legs fully visible;
- scripted age-appropriate guidance;
- immediate feedback;
- can be minimized;
- captions;
- no open AI chat.

### Skins, stands, backgrounds

- live preview;
- real asset status;
- compatibility;
- no Canvas remount;
- no clipping;
- material quality;
- tier variants;
- download/integrity/rollback;
- full 3D premium backgrounds.

### Store

- localized real price;
- free/owned/downloaded/installed/active distinct;
- preview before purchase;
- no dark patterns;
- no internal currency;
- restore;
- Parent Gate;
- server verification.

### Parent Gate and Parent Center

- cannot bypass via Back/restart/deep link;
- secure PIN verifier;
- large text;
- clear age controls;
- content summary;
- downloads/store/privacy;
- destructive confirmation.

### Offline/download/update

- visible status;
- pause/resume;
- free-space check;
- checksums;
- atomic activation;
- previous version rollback;
- no corrupted active content.

### Empty/error/loading

- branded but restrained;
- plain language;
- exact recovery action;
- no raw stack trace;
- no infinite spinner;
- works with screen reader.

### Audio/haptics

- optional;
- independent controls;
- no auto loud sound;
- spatial ambience stops in background;
- narration has captions;
- child-safe volume;
- haptic respects settings.

### Typography and icons

- licensed/self-hosted fonts;
- correct Russian glyphs;
- no text embedded in UI images;
- consistent icon family;
- no emoji as functional icon;
- Dynamic Type/large text.

## 4. Premium Quality Scorecard

Перед Release Candidate сформировать scorecard 0–100:

- canonical globe and 3D: 20;
- visual craft/3D backgrounds: 15;
- core UX/navigation: 15;
- content trust/rights: 10;
- child safety/parent controls: 15;
- store/entitlements: 10;
- performance/reliability: 8;
- accessibility/localization: 7.

Release candidate допускается только при:

- total >= 92;
- ни одна категория не ниже 85%;
- P0/P1 = 0;
- no placeholder shipping;
- no fake content;
- no premium 2D-only background;
- no failing mandatory gate.

Score не заменяет тесты и owner review, а суммирует evidence.

## 5. Evidence package

Для каждого major screen/component:

- screenshots phone 320/390/430;
- tablet;
- landscape;
- light/dark system context where relevant;
- adult/child;
- large text;
- reduced motion;
- offline/error;
- before/after;
- accessibility report;
- performance trace where relevant;
- exact commit SHA.

## 6. Запреты для Release Candidate

Нельзя оставлять:

- TODO/FIXME в critical path;
- lorem ipsum;
- mock price;
- fake portrait/flag/cover;
- unreviewed biography;
- flat image sold as 3D;
- broken or generic placeholder icon;
- raw error;
- inaccessible control;
- clipped text;
- cropped mascot limbs;
- duplicate Canvas/listener;
- unbounded cache;
- missing restore purchase;
- unverified entitlement;
- adult data leakage in child mode.
