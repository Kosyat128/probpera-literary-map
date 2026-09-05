# ПЛАНЕТКА, ЛИТЕРАТУРНЫЕ ПУТЕШЕСТВИЯ И ОБУЧАЮЩАЯ ЛОГИКА — V12 BINDING CONTRACT

## 1. Роль Планетки

Планетка — оригинальный главный герой детского режима и необязательный
помощник взрослого режима. Она не заменяет готовую Литературную планету
сайта: лицо, руки, ноги, одежда и аксессуары являются отдельными объектами
поверх той же сферы, географии, камеры и системы выбора стран.

Планетка:

- приветствует;
- объясняет вращение, масштабирование и выбор страны;
- предлагает литературные маршруты;
- знакомит со страной, автором и произведением;
- сообщает только редакционно проверенные факты;
- помогает при offline/error состоянии;
- предлагает продолжить с сохранённого смыслового шага;
- поздравляет без streak pressure, наказаний и покупочных призывов;
- сворачивается и не мешает чтению/исследованию;
- имеет captions для каждой озвученной реплики.

Запрещено:

- open generative AI chat;
- свободные непроверенные factual answers;
- mandatory microphone;
- voice cloning;
- imitation Disney/другого IP;
- behaviour-based child profiling;
- рекламу IAP ребёнку;
- реплики, заставляющие купить или торопиться.

## 2. Визуальный контракт

- рот ниже глаз;
- доброжелательные крупные глаза;
- руки и ноги полностью видны в Mascot Mode;
- face/limbs separate from globe surface;
- geography не искажается;
- no clipping на 320–1024 px, portrait/landscape;
- animations работают через state machine;
- reduced-motion заменяет движения спокойными poses/fades;
- background/foreground останавливает animations;
- mascot excluded from accessibility tree, functional controls доступны.

## 3. State machine

```text
boot
→ greeting
→ idle
→ hint
→ journey-introduction
→ country-introduction
→ writer-introduction
→ work-introduction
→ task
→ feedback
→ celebration
→ continue-or-home
```

Дополнительные states:

- blink;
- thinking;
- reading;
- tap reaction;
- sleep;
- offline helper;
- recoverable error;
- Parent Gate handoff;
- transition-to-explore;
- transition-to-mascot;
- paused;
- reduced-motion.

Every transition cancellable; only latest semantic intent wins. No queued
animation that plays after route/profile changes.

## 4. Dialogue registry

Каждая реплика имеет:

- stable ID;
- locale;
- exact age range;
- reading level;
- intent;
- screen/context;
- allowed entity IDs;
- source references for factual claims;
- reviewer/date/status;
- narration asset and rights;
- caption text;
- reduced copy;
- prohibited topic tags;
- version/checksum.

`not-reviewed`, missing source, wrong age, expired rights = unavailable.

## 5. Литературное путешествие

Модель:

```text
Journey
├── title/description
├── age/reading level
├── estimated duration
├── offline availability
├── prerequisites
├── nodes[]
│   ├── country
│   ├── place
│   ├── writer
│   ├── work
│   ├── character/world
│   ├── sourced fact
│   ├── activity
│   └── checkpoint
└── completion/reward
```

Journey nodes никогда не содержат invented fact. Географическая точка
использует canonical coordinates сайта.

## 6. Базовые маршруты

Подготовить production-ready минимум:

- «Сказки народов мира»;
- «Сказки Пушкина»;
- «Мир Андерсена»;
- «По следам Жюля Верна»;
- «Русские писатели XIX века»;
- «Великие детские писатели Европы»;
- «Морские путешествия в книгах»;
- «Литературные животные»;
- «Приключения на карте мира»;
- возрастной introductory route Планетки.

Фактический состав зависит от approved content/rights. Если узел не
разрешён профилю, маршрут строится из approved alternatives либо скрыт.

## 7. Задания

Допустимы:

- найти страну;
- выбрать автора;
- сопоставить произведение и автора;
- выбрать подтверждённый факт;
- расположить события/книги по эпохе;
- найти персонажа по описанию;
- собрать литературный маршрут;
- ответить на age-appropriate multiple choice.

Запрещены dark patterns, endless grind, loss of progress, paid answer,
leaderboard ребёнка, публичное сравнение и streak punishment.

## 8. Литературный паспорт

Локальная/optional-sync коллекция:

- открытые страны;
- изученные писатели;
- изученные произведения;
- завершённые journeys;
- collected badges;
- downloaded routes.

Badge — не валюта и не открывает обязательный платный контент. Child data
private, removable by parent, not public.

## 9. Продолжить путешествие

Сохранять semantic progress, а не frame-by-frame camera data:

- journey ID/version;
- current node;
- completed nodes;
- selected country/writer/work;
- active profile;
- active customization;
- last safe route;
- content version.

При несовместимом update выполнить migration или открыть ближайший valid
checkpoint без потери completed progress.

## 10. Озвучивание

- optional;
- отключено до parent/adult consent;
- original/rights-cleared voices;
- no cloned actor/character voice;
- transcript/caption mandatory;
- audio focus/interruption handling;
- Bluetooth/headphones tests;
- no autoplay after resume;
- volume and sensory controls;
- licensed character narration только при explicit rights.

## 11. Админка

Owner может:

- создавать journey через graph editor;
- выбирать canonical entities;
- добавлять sourced fact/activity;
- задавать age/reading level;
- писать/редактировать реплики;
- прикреплять narration;
- запускать child/rights/locale validation;
- preview на каждой platform/profile;
- publish/rollback;
- просматривать completion/error агрегаты без child profiling.

## 12. Acceptance

- Планетка не заменяет globe;
- no open AI chat;
- all factual lines sourced;
- all dialogue reviewed;
- child commerce absent;
- resume/migration works;
- reduced-motion/audio/accessibility work;
- offline journey works;
- route never exposes disallowed entity;
- no memory/listener leak after repeated mascot/explore transitions.
