# UX и QA-контракт «Герои книг» V6

## Центральная идея

Планетка остаётся главным проводником. Русские и зарубежные литературные
герои появляются в отдельных StoryWorld и ведут ребёнка к настоящей
книге, автору и стране на существующей Литературной планете сайта.

## Обязательные пользовательские потоки

1. Детский Home → «Герои книг» → категория → герой → произведение → автор
   → «Показать на планете» → страна.
2. Планетка → рекомендация по точному возрасту → герой → короткое задание.
3. Поиск героя → только approved character index.
4. Offline StoryWorld → тот же age/rights policy.
5. Parent Center → источник, возраст, права, управление доступностью.
6. Магазин → только active rights-cleared pack; покупка за Parent Gate.

## Visual quality

- Реальные approved/commissioned/licensor assets.
- Никаких AI-lookalike защищённых героев.
- Никаких кадров мультфильмов и вырезанных обложек.
- Персонаж не закрывает глобус, подписи или CTA.
- Один visual hero на экране; Планетка компактно сопровождает.
- На слабом устройстве используется качественный 2.5D/static fallback.

## Rights tests

- blocked отсутствует в production export, search, preview, store, screenshot data;
- territory mismatch отсутствует;
- expired pack delisted;
- missing asset hash fails publish;
- missing source/author fails publish;
- public-domain candidate without evidence fails publish;
- licensed pack without document fails publish;
- film/cartoon still detector/manual audit blocks publication;
- AI/lookalike/voice-clone policy acknowledged and audited;
- marketing permission checked separately from in-app permission.

## Age tests

- exact age проверяет character, work, dialogue, quest, animation, audio и background;
- unknown metadata fail-closed;
- adult episode не открывается через approved hero;
- profile age change requires Parent Gate;
- search/autocomplete/history/cache/deep link/offline obey the same policy;
- parent blocked topic has higher priority than catalog recommendation.

## Educational tests

- каждый active герой связан с произведением;
- каждое произведение связано с реальным автором/tradition;
- автор связан со страной/координатой, если это применимо;
- факт имеет source/reviewer;
- реплика не выдаётся за цитату без подтверждения;
- задания не манипулируют и не наказывают ребёнка;
- нет открытого AI-чата.

## Performance tests

- один Canvas и один renderer;
- character mesh не участвует в country picking;
- 30 переключений StoryWorld без растущей GPU/audio memory;
- background/resume не дублирует listeners/animations;
- Economy fallback сохраняет навигацию и литературную ценность.

## Acceptance evidence

Codex должен сохранить реальные runtime screenshots и test reports для:

- русских StoryWorld;
- зарубежных StoryWorld;
- CharacterDetail;
- character-to-globe journey;
- Parent Rights view;
- blocked licensed pack в админке;
- child search;
- offline flow;
- large text;
- VoiceOver/TalkBack;
- phone/tablet portrait/landscape.
