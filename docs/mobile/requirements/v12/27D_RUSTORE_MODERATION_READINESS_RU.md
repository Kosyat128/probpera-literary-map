# RUSTORE MODERATION READINESS — V12

## 1. Карточка и платная модель

- Тип приложения: «Платное».
- Подключена монетизация.
- Цена задана до отправки.
- Название в карточке и установленном приложении согласовано.
- Скриншоты обязательны и отражают реальную сборку.
- Описание не содержит кликбейта и неподтверждённых обещаний.

## 2. Самостоятельная ценность

RuStore-сборка не должна быть простым перенаправлением на probpera.ru.

Локально/нативно должны работать:

- канонический 3D-глобус;
- mobile navigation;
- поиск;
- профили писателей;
- избранное;
- child mode;
- Планетка;
- Parent Gate;
- Starter Set;
- offline bootstrap;
- магазин;
- загрузки;
- восстановление состояния.

Сайт остаётся источником истины и canonical links, но не заменяет
приложение.

## 3. Тестовый доступ

Предоставить:

- стабильный review account;
- Parent PIN;
- путь к child mode;
- путь к store;
- тестовые непотребляемые товары;
- инструкции оплаты/восстановления;
- account deletion;
- Economy mode;
- offline behavior.

Не использовать одноразовые SMS, личную биометрию и owner intervention.

## 4. Интеллектуальная собственность

Подготовить evidence по:

- бренду «Проба пера»;
- домену;
- Планетке;
- портретам;
- флагам;
- обложкам;
- историческим глобусам;
- музыке/озвучиванию;
- StoryWorld;
- лицензированным персонажам.

Disney/Pixar и другие blocked assets отсутствуют из production APK и
metadata до лицензии.

## 5. Permissions

Проверить manifest и заполнить декларации для фактически используемых
разрешений. Запрещённые/необоснованные permissions блокируют release.

По умолчанию не нужны:

- камера;
- микрофон;
- геолокация;
- контакты;
- SMS;
- журнал вызовов;
- широкий доступ к хранилищу;
- рекламный идентификатор.

## 6. RuStore Pay

- отдельный RuStore variant;
- актуальный Pay SDK;
- deprecated BillingClient не использовать;
- серверная проверка/уведомления;
- непотребляемые optional products;
- pending/cancel/restore/refund;
- подпись приложения согласована;
- sandbox/тестовый flow после необходимых шагов модерации.

## 7. Build and update consistency

- RuStore variant не содержит Google Play Billing/links.
- Обновление направляет пользователя через RuStore.
- Version code/name согласованы с release train.
- RuStore-версия не должна неоправданно отставать от других публичных
  магазинов.
- Signing certificate/fingerprint стабилен.
- Новая сборка обновляет предыдущую.

## 8. Screenshots

- exact RuStore RC;
- реальные функции;
- разрешённые portrait/flags;
- no Disney;
- no Google Play/App Store badges;
- no fake price;
- no future screens;
- correct Russian copy;
- required orientations/sizes;
- caption text does not mislead.

## 9. Stability

Test:

- установка/обновление;
- холодный запуск;
- offline;
- слабое устройство;
- WebGL recovery;
- Economy background;
- Back;
- child cold start;
- Parent Gate;
- Pay flow;
- restore;
- permissions denied;
- no links to competing stores.

## 10. Submission blockers

- app not marked paid;
- price/monetization absent;
- simple web redirect;
- inaccessible review flow;
- IP evidence absent;
- prohibited permission;
- other-store link;
- screenshots do not match;
- outdated/lower release;
- deprecated billing;
- signature mismatch;
- crash/black globe;
- adult content leak in child mode.
