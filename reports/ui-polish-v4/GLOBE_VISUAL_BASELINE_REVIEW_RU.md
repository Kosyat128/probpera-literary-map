# Проверка эталонов управления глобуса после совместной сборки

2026-09-08, локальный compiled preview4186, desktop1440×900 / mobile390×844, один worker. Production не публиковался.

Первоначально запущены два сценария `globe-visual-regression.spec.mjs` с `--update-snapshots=changed`: **2/2 passed,16.8s**; `globe-visual-reviewed.log`. После этого **оба обычных сравнения прошли без обновления эталонов** в `owner-final-e2e.log`: desktop4.6s/mobile6.5s. Таким образом, генерация эталонов и последующая проверка существующих PNG разделены в evidence.

Все четыре прежних PNG сохранены в `globe-visual-reviewed-before/`. До обновления просмотрены desktop/mobile chrome и обе карточки писателя. После обновления просмотрены оба изменённых chrome PNG: одинаковые белые фильтр/поиск в нужном порядке, компактная desktop сетка, крупные mobile цели, отдельные стрелки за границами прокручиваемой полосы, выбранное издание видно. Фактические изменения соответствуют разрешённому R05 и новому запросу о качестве управления.

| PNG | Результат |
| --- | --- |
| globe-desktop-top-chrome-edition-rail.png | Обновлён после просмотра: compact icon controls, новая типографика identity, отдельные skin arrows |
| globe-mobile-top-chrome-edition-rail.png | Обновлён после просмотра: белые filter/search и отдельные44px стрелки |
| globe-desktop-writer-card.png | Побайтно сохранён: SHA256 decb7bfd5304190c5ab80c22e09011cb3b51f57a664d44ad222ac33ed030a2ae |
| globe-mobile-writer-card.png | Побайтно сохранён: SHA256 2f5fe21d723e7bdd9e47bdd795e813f89eedc1c52c8e69dd73b35343832bb235 |

Полная before/after SHA256 карта - `globe-visual-reviewed-hashes.json`. Параметры сравнения и прежний screenshot-only CSS стабилизации сохранены. Этот давний узкий контракт исключает WebGL/звёзды из pixel comparison; реальные немаскированные сцены проверены отдельными кадрами dark-panel и root capture. Его нельзя трактовать как новую визуальную приёмку всех фонов.

Перед78 batch постоянный R05 сценарий также дополнен проверкой поля ниже sticky header до и после ввода, расстояния результатов до сцены/верхних кнопок, внутренней прокрутки End/Home/ArrowDown при неизменном window.scrollY и сохранённом фокусе.

Итог выбранного runtime-набора на неизменном product source9d483c: основной запуск65 passed /5 failed /8 skipped; round1 -2 passed /3 failed /1 skipped; round2 -4 passed /0 failed /0 skipped,33.5s (`owner-final-e2e-addendum-2.log`). **70 уникальных выполняемых сценариев закрыты, 8 имеют штатный skip**; повторные occurrences не суммируются. Исправлены только условия оставшихся тестов: внутренние bounds с учётом рамкиstage, подготовка видимого pointer target, сохранённые фильтры при входе в fullscreen. Native focus/Tab доказательства и все исходные failures сохранены в `R04-R05-CONTROLS.md`, `stage-focus-scroll/results.json` и `final-control-triage/results.json`. Product/PNG этих addendum не менялись. Это не новый полный230-test запуск и не художественная приёмка всех фоновых стыков.
