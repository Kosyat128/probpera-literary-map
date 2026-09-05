# MODERATION READINESS MASTER — V12

## 1. Цель

Подготовить не просто технически работающий продукт, а точный, правдивый,
стабильный и юридически поддерживаемый комплект для модерации:

- Apple App Store;
- Google Play;
- RuStore;
- платной Web/PWA-редакции.

Модерационная готовность проверяется на точном release candidate, а не на
макете, development-сборке или более новой локальной ветке.

## 2. Общая последовательность

```text
feature complete
→ internal QA
→ release candidate freeze
→ exact artifact build
→ artifact inventory
→ rights scan
→ privacy/data-flow scan
→ permission scan
→ age/target-audience review
→ reviewer-access validation
→ IAP sandbox validation
→ screenshot capture
→ metadata validation
→ store dossier generation
→ owner/legal approval
→ manual submission
```

После freeze функциональные изменения требуют нового build number,
повторного artifact scan и обновления всех связанных материалов.

## 3. Единый Review Build Identity

Для каждой платформы создать `BUILD_IDENTITY.json`:

- app name;
- package/bundle ID;
- semantic version;
- build number;
- Git commit SHA;
- canonical content version;
- child policy version;
- customization catalog version;
- purchase catalog version;
- rights manifest version;
- build timestamp;
- toolchain versions;
- signing status;
- artifact filename;
- SHA-256;
- environment;
- backend base/environment ID;
- screenshot set version;
- review-notes version.

Все store screenshots, reviewer notes и privacy declarations обязаны
ссылаться на эту identity.

## 4. Common Moderation Gate

Проверить:

- приложение запускается с clean install;
- платная модель описана честно;
- Starter Set присутствует;
- IAP действительно необязательны;
- child mode входит в базовую покупку;
- adult и child режимы не смешиваются;
- Parent Gate не обходится;
- review access воспроизводим;
- account deletion работает, если есть аккаунты;
- permissions минимальны;
- privacy declarations соответствуют сетевым вызовам и SDK;
- реальные портреты/флаги/биографии имеют provenance;
- unlicensed characters отсутствуют из binary;
- concept collage не используется в listing;
- screenshots соответствуют exact build;
- store-specific links/providers не смешиваются;
- приложение не является удалённой оболочкой сайта;
- offline bootstrap работает;
- 3D-глобус имеет Economy fallback;
- нет broken controls или бесконечного loader.

## 5. Store-specific dossiers

Создать:

```text
store/app-store/review/
store/google-play/review/
store/rustore/review/
store/web-pwa/review/
```

Каждый dossier включает:

- build identity;
- review notes RU/EN;
- access instructions;
- reviewer account reference;
- Parent PIN reference;
- sandbox products;
- paid model;
- Starter Set;
- child mode explanation;
- privacy/permissions;
- rights summary;
- age-rating disclosure;
- account deletion;
- screenshot inventory;
- known limitations;
- contact and response SLA;
- artifact checksum.

## 6. No Surprise Principle

Любая функция, которая может удивить модератора, должна быть объяснена:

- платное приложение плюс необязательные IAP;
- child mode внутри приложения общей аудитории;
- внешние ссылки только за Parent Gate;
- офлайн-загрузка;
- optional account;
- 3D WebGL runtime;
- разные Android store variants;
- Disney-каталог отсутствует из production без лицензии;
- PWA является отдельной одноразовой лицензией;
- review sandbox не является способом обхода оплаты для пользователей.

## 7. Final moderation status

Разрешённые статусы:

- `NOT_STARTED`
- `IN_PROGRESS`
- `BLOCKED_INTERNAL`
- `BLOCKED_EXTERNAL`
- `READY_FOR_OWNER_REVIEW`
- `READY_FOR_SUBMISSION`
- `SUBMITTED`
- `REJECTED`
- `RESUBMISSION_READY`
- `APPROVED`

`READY_FOR_SUBMISSION` нельзя ставить при:

- failing technical gate;
- broken reviewer access;
- missing privacy/account-deletion path;
- unclear target audience;
- unlicensed asset;
- misleading screenshot;
- missing paid-app configuration plan;
- incomplete IAP sandbox;
- unsigned/incorrect artifact where signing is required.

## 8. Evidence storage

Все доказательства неизменяемо сохраняются в:

```text
reports/moderation/<store>/<version-build>/
```

Включать:

- command logs;
- device/system versions;
- screenshots/videos;
- privacy scan;
- permission scan;
- network capture summary;
- rights scan;
- test results;
- reviewer-access smoke;
- checksum inventory;
- store-console screenshots, добавляемые владельцем;
- rejection/resubmission history.

## 9. Owner handoff

Codex должен оставить владельцу один файл:

`docs/mobile/MODERATION_OWNER_HANDOFF_RU.md`

В нём:

- что полностью готово;
- что требует аккаунта магазина;
- какие значения нужно ввести;
- где взять готовые тексты;
- какие файлы загрузить;
- как проверить цену;
- как выдать reviewer access;
- как отправить;
- как отвечать на замечание;
- как безопасно откатить релиз.

Модерационная готовность не означает гарантированное одобрение, но должна
устранить все предотвратимые технические, контентные и документальные
причины отказа.
