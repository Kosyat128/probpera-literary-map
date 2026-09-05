# V12 — ПОЛНОЦЕННЫЙ FULL-3D BACKGROUND SCENE ENGINE

## 1. Высший owner lock

Фоны не являются плоскими картинками за глобусом.

Каждый новый PREMIUM-фон обязан быть настоящей трёхмерной сценой в
High и Balanced tiers. Сцена должна иметь реальную геометрию, минимум три
плана глубины, корректную перспективу и parallax, освещение, материалы,
пространственную композицию и ambient animation.

2.5D, skybox и static image разрешены только как:

- Economy fallback;
- аварийный fallback;
- loading placeholder;
- preview thumbnail;
- вариант для устройства, которое не выдерживает full 3D.

Нельзя продавать статичную картинку как «3D-фон».

## 2. Критерий настоящего 3D-фона

Фон считается full 3D только если одновременно выполнено:

- вокруг globe stage существует mesh-based environment;
- foreground, midground и background имеют физическую глубину;
- при безопасном изменении камеры виден parallax;
- props реагируют на общий light rig либо baked lighting;
- есть корректные shadows/contact shadows/lightmaps;
- минимум один ненавязчивый ambient animation channel;
- нет единственной плоскости с изображением;
- cubemap не является единственным содержимым;
- сцена имеет LOD и performance tiers;
- globe picking, camera focus и labels не блокируются;
- сцена проходит mobile GPU/memory stress.

## 3. Архитектура одной сцены

Каждый `BackgroundScenePackage` содержит:

- `sceneId` и stable version;
- `sceneGraph`;
- `environmentRoot`;
- `foregroundRoot`;
- `midgroundRoot`;
- `backgroundRoot`;
- `lightingRig`;
- `lightmaps/lightProbes`;
- `reflectionEnvironment`;
- `atmosphere/fog`;
- `particleSystems`;
- `ambientAnimations`;
- `interactiveProps`;
- `globeClearanceVolume`;
- `mascotClearanceVolume`;
- `cameraSafeVolume`;
- `uiContrastZones`;
- `audioAmbience`;
- `qualityTiers`;
- `fallbackChain`;
- `rights/provenance/checksum`;
- `minAge/maxAge/sensitivityTags`;
- `compatibility` со skins, stands и devices.

Scene manager живёт внутри того же R3F Canvas и не создаёт второй renderer.
BackgroundRoot не владеет камерой и не изменяет canonical globe radius,
projection или geographic transforms.

## 4. Визуальное качество

Для каждой сцены обязательны:

- единый реальный масштаб;
- PBR materials без пластикового блеска там, где он неуместен;
- чистые normal/roughness/metalness maps;
- отсутствие растянутых textures;
- отсутствие видимых UV seams;
- отсутствие z-fighting;
- отсутствие floating props;
- отсутствие clipping глобуса, Планетки, подставки и UI;
- аккуратный anti-aliasing;
- controlled exposure и tone mapping;
- цветовая совместимость с конкретным globe skin;
- readable silhouette;
- мягкие contact shadows;
- мобильные baked lightmaps/probes вместо большого числа dynamic lights;
- no uncontrolled transparency/overdraw;
- no noisy particles;
- no cheap looping video;
- no black frame при загрузке.

## 5. Качество по tiers

High:

- полный scene geometry;
- high texture set;
- полноценные lightmaps/reflections;
- дополнительные ambient details;
- 60 FPS target на целевых high devices.

Balanced:

- тот же художественный замысел и реальная 3D-геометрия;
- lower LOD/texture resolution;
- fewer particles/animated props;
- 60 FPS target на среднем устройстве.

Economy:

- 3D-lite scene с сохранением основных mesh-силуэтов;
- минимальные particles;
- baked lighting;
- 30 FPS minimum target;
- при нехватке памяти допускается 2.5D/static fallback с честной внутренней
  классификацией, но пользователь не теряет функциональность.

## 6. Переход между фонами

Transaction:

1. Сохранить active composition и semantic globe state.
2. Preload low/Balanced scene package.
3. Проверить checksum, права, compatibility и memory budget.
4. Создать scene off-state внутри существующего Canvas.
5. Прогреть shaders/materials без видимого flash.
6. Выполнить controlled crossfade/dissolve/portal transition.
7. Синхронно интерполировать light/exposure/ambience.
8. Сохранить camera target, selected country/writer и mode.
9. Commit only after scene ready.
10. Освободить старые assets после successful commit.
11. При ошибке оставить старую сцену.
12. Rapid A→B→C: коммитится только C.

Запрещены:

- remount Canvas;
- camera reset;
- исчезновение выбранной страны;
- чёрный кадр;
- скачок exposure;
- две тяжёлые сцены дольше transition window;
- продолжение particles/audio в background;
- потеря preview rollback state.

## 7. Интерактивность

3D background может содержать hotspots, но они:

- не конкурируют с globe picking;
- включаются отдельным режимом «Осмотреть сцену»;
- ведут к литературному содержанию;
- имеют keyboard/screen-reader alternative;
- не превращают приложение в wandering game;
- отключаются в Economy при необходимости;
- проходят age/rights policy.

Примеры:

- книга на столе открывает curated journey;
- портретная рама открывает писателя только через реальный approved portrait;
- телескоп показывает созвездие и связанный литературный маршрут;
- карта на стене возвращает к глобусу;
- вагон поезда запускает путешествие по странам.

## 8. Начальный обязательный каталог full-3D сцен

Бесплатные:

1. `museum-starfield-3d` — развитие существующих MuseumSkyDome и
   MuseumStarfield: многослойные звёзды, реальная глубина, мягкая туманность,
   редкая shooting star, no-loop в idle.
2. `probpera-library-3d` — фирменный тёмный читальный зал.
3. `planetka-room-3d` — безопасная детская комната Планетки.

Общие premium:

4. `grand-library-3d` — двухэтажная библиотека с лестницами, галереями,
   окнами и точками литературных маршрутов.
5. `writers-study-3d` — кабинет с письменным столом, пером, картами и
   сменой времени суток.
6. `celestial-observatory-3d` — купол, телескоп, звёздные маршруты.
7. `museum-of-maps-3d` — музей исторических глобусов и карт.
8. `floating-book-archive-3d` — архив с парящими книгами без визуального
   хаоса.
9. `old-scriptorium-3d` — скрипторий, пергаменты, мягкий огонь.
10. `literary-theatre-3d` — сцена мировой литературы.
11. `autumn-literary-park-3d` — парк, беседка, листья и мягкий ветер.
12. `winter-reading-hall-3d` — зимний зал без чрезмерных частиц.
13. `ocean-of-stories-3d` — морской зал и окно в подводный мир.
14. `northern-lights-library-3d` — библиотека под северным сиянием.

Оригинальные детские premium:

15. `cloud-library-3d` — острова-облака, книжные мосты.
16. `story-forest-3d` — волшебный лес чтения с оригинальными героями.
17. `underwater-library-3d` — библиотека под водой с безопасной фауной.
18. `story-train-3d` — вагон и станции литературных стран.
19. `treehouse-reading-3d` — домик на дереве и карты путешествий.
20. `cosmic-classroom-3d` — космический класс Планетки.
21. `land-of-letters-3d` — объёмные буквы и книжные дорожки.
22. `snowy-story-square-3d` — зимняя площадь без пугающей темноты.
23. `dinosaur-book-island-3d` — оригинальный educational island.
24. `animal-reading-circle-3d` — оригинальные читающие зверята.

Licensed StoryWorld создаются тем же engine, но остаются blocked до
подтверждённых прав.

## 9. Asset pipeline

Разрешённые форматы после проверки платформ:

- glTF/GLB;
- KTX2/Basis textures;
- Meshopt/Draco только после измерения decode cost;
- baked lightmaps;
- instancing;
- LOD;
- atlas textures там, где не ухудшается качество;
- compressed audio;
- AVIF/WebP только preview/fallback.

Каждая сцена проходит:

- source validation;
- rights check;
- geometry audit;
- texture audit;
- material audit;
- mobile import/conversion;
- checksum;
- device tier build;
- screenshot/video evidence;
- 30-switch stress;
- 20-minute soak;
- low-memory fallback;
- offline install/update/rollback.

## 10. Admin Background Studio

Owner может без изменения runtime-кода:

- создать draft scene;
- загрузить full-3D source;
- настроить anchors, clearances, lights, fog, audio и hotspots;
- загрузить High/Balanced/Economy variants;
- указать 2.5D/static fallback;
- настроить compatibility;
- проверить phone/tablet previews;
- запустить automated QA;
- назначить free/SKU/bundle;
- опубликовать atomically;
- откатить version;
- delist по rights/quality issue.

## 11. Full-3D Definition of Done

Ни одна premium scene не считается готовой, пока:

- High и Balanced действительно full 3D;
- Economy имеет 3D-lite либо честный fallback;
- один Canvas сохранён;
- camera/geography/picking не изменены;
- no visual seams/clipping/z-fighting;
- 3D depth/parallax доказаны видео;
- lighting/materials прошли art review;
- phone portrait/landscape/tablet проверены;
- FPS/memory budgets green;
- background/resume/low-memory green;
- transition/rollback green;
- rights/checksum/provenance заполнены;
- accessibility/reduced-motion green.
