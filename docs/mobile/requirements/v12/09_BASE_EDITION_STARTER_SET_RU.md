# BASE EDITION STARTER SET V12 — ОБЯЗАТЕЛЬНЫЙ СОСТАВ ПЛАТНОГО ПРИЛОЖЕНИЯ

## 1. Назначение

Этот документ исключает ситуацию, когда пользователь покупает приложение,
но получает бедную оболочку с большим количеством обязательных доплат.

Все перечисленные ниже возможности и материалы входят в базовую цену.
Для них запрещено создавать In-App Purchase SKU.

## 2. Каноническое литературное ядро

Включено:

- 3D «Литературная планета» сайта;
- все доступные страны канонической базы;
- verified writer profiles;
- verified biographies;
- works/books metadata;
- Nobel context;
- поиск;
- фильтры;
- country/writer/work screens;
- Favorites;
- Recent/History;
- Collections;
- «Показать на планете»;
- canonical article links вне child mode;
- базовый offline package;
- updates/corrections в пределах поддерживаемой major version.

Если права на конкретный media asset ограничены платформой/территорией,
скрывается только этот asset с безопасной заменой; основная запись и
навигация не должны исчезать без причины.

## 3. Базовые режимы планеты

Included:

1. Explore Mode.
2. Mascot Mode.
3. Детский Mascot Mode.
4. Country focus.
5. Writer focus.
6. Auto rotation.
7. Manual touch/keyboard controls.
8. Accessibility country list.
9. Reduced motion.
10. Graphics tiers.
11. WebGL recovery.
12. Offline globe bootstrap.

## 4. Included globe skins

Минимум пять:

### `base.antique`
Канонический исторический/фирменный default, фактическое название и edition
ID берутся из текущего site registry.

### `base.modern`
Современный atlas с текущей географией и локализованными labels.

### `base.earth`
Физическая/реальная Земля или текущий production equivalent.

### `base.child-educational`
Детский учебный глобус с точной underlying geography, программными
подписями и child-safe декором.

### `base.planetka-cheerful`
Весёлая Планетка с отдельными face/limb objects.

Правило grandfathering:

Любое production-ready издание глобуса, доступное на сайте как основная
возможность до запуска mobile paid app, остаётся included и не может быть
переведено задним числом в optional purchase.

## 5. Included stands

Минимум четыре:

1. `base.stand.museum` — классическая музейная.
2. `base.stand.wood` — деревянная.
3. `base.stand.book-stack` — стопка книг.
4. `base.stand.child-book-cloud` — детская книжная/облачная.

Каждая stand:

- production-ready;
- responsive;
- не ломает picking;
- не перекрывает лицо;
- имеет high/balanced/economy;
- имеет preview;
- имеет checksum/provenance;
- доступна offline после установки.

## 6. Included backgrounds

Минимум пять:

1. `base.background.site-starfield`
   - текущие MuseumSkyDome/MuseumStarfield;
   - base default/fallback.

2. `base.background.library`
   - фирменная библиотека;
   - mobile derivatives;
   - no copyrighted characters.

3. `base.background.writer-study`
   - кабинет писателя;
   - original/rights-cleared props.

4. `base.background.child-reading-room`
   - светлая детская комната чтения;
   - Планетка;
   - no third-party characters.

5. `base.background.story-forest`
   - original fairy-tale forest;
   - child-safe;
   - no Disney imitation.

Каждый background имеет:

- scene type;
- quality tiers;
- lighting preset;
- optional ambient audio;
- reduced-motion mode;
- static fallback;
- memory budget;
- compatibility;
- checksum;
- rights/provenance.

## 7. Included Planetka assets

- base face rig;
- eyes;
- brows;
- mouth;
- cheeks;
- hands;
- legs;
- shoes/feet;
- idle;
- blink;
- wave;
- tap reaction;
- success;
- thinking;
- sleep;
- transition to Explore;
- reduced-motion poses;
- captions.

Included accessories:

- quill badge;
- explorer backpack;
- star scarf;
- book badge.

No purchase is required to use Планетка as guide.

## 8. Included child mode

- up to four local profiles;
- exact age;
- reading level;
- Parent Gate;
- secure PIN;
- Parent Center;
- child Home;
- child globe;
- child search;
- approved child writers;
- approved child works;
- child biographies;
- child favorites/history;
- child offline package;
- age policy;
- topic policy;
- no ads;
- no open AI chat;
- no mandatory microphone.

## 9. Included StoryWorlds

Minimum six production-ready worlds.

### `base.world.planetka`
Original project world.

### `base.world.russian-folklore`
Original artwork based on rights-cleared folklore sources.

### `base.world.pushkin-tales`
Rights-reviewed original artwork and text references.

### `base.world.andersen`
Original artwork based on rights-cleared source/translation track.

### `base.world.alice-literary`
Literary source track only; no Disney visual assets.

### `base.world.oz-literary`
Literary source track only; no MGM/Disney visual assets.

If one candidate fails territory/translation/asset review, replace it with
another original owner-created literary world before release. Do not ship
fewer than six.

## 10. Included offline content

Minimum:

- app shell;
- globe bootstrap;
- country index;
- writer search index;
- selected core biographies;
- child bootstrap;
- Planетка scripts;
- Starter Set assets;
- last verified entitlements;
- help/privacy/parent instructions.

## 11. Included quality and safety

Never sell separately:

- accessibility;
- VoiceOver/TalkBack;
- reduced motion;
- security fixes;
- privacy controls;
- Parent Gate;
- exact-age filtering;
- data deletion;
- crash recovery;
- WebGL recovery;
- content integrity;
- app updates required for compatibility.

## 12. Starter Set acceptance

Release blocked unless:

- all required items exist;
- all items load on three platforms;
- assets have checksums;
- rights/provenance complete;
- no placeholder;
- no generated real-person portrait;
- no unlicensed Disney;
- child items pass age review;
- offline base works;
- 30-switch stress passes;
- visual baselines approved;
- `starter-set-completeness.json` reports PASS.

## 13. Store messaging

Store listing must state:

- paid one-time app;
- no subscription;
- no advertising;
- large Starter Set included;
- child mode included;
- optional extra themes exist;
- base educational experience does not require further purchase.

Do not call the Starter Set “free”. It is included in the paid purchase.
