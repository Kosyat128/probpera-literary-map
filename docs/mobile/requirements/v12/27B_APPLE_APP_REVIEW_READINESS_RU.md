# APPLE APP REVIEW READINESS — V12

## 1. Идентичность

- App name по умолчанию: `Литературная планета`.
- Subtitle: `Проба пера`.
- Проверить текущий лимит символов в App Store Connect.
- Bundle ID и название совпадают с signing/configuration.
- Иконка, splash, screenshots и publisher identity согласованы.
- Не использовать `Official`, Disney или Pixar без доказанных прав.

## 2. Product strategy

По умолчанию приложение подаётся как образовательное приложение общей/
семейной аудитории с защищённым child mode.

Не выбирать Kids Category автоматически. До такого решения отдельно
проверить:

- актуальные Kids Category правила;
- сторонние SDK;
- внешние ссылки;
- Parent Gate;
- аналитика;
- данные;
- будущая дорожная карта;
- невозможность легко изменить позиционирование после выпуска.

## 3. Whole-app age rating

Анкета заполняется по всему binary. Создать disclosure по потенциально
чувствительным темам adult archive. Не занижать rating из-за наличия
фильтрованного child mode.

## 4. Review Information

Предоставить:

- стабильный demo/review account, если аккаунт нужен;
- review Parent PIN;
- пошаговый путь к child mode;
- путь к store;
- тестовый non-consumable IAP;
- путь к Restore Purchases;
- account deletion path;
- offline test;
- Economy graphics;
- сведения о server/backend;
- контакт.

Credentials:

- не истекают во время review;
- не требуют SMS/OTP;
- не требуют реального biometric prompt;
- не зависят от географии/IP;
- проверены на clean device.

## 5. Paid application

Перед submission:

- активное Paid Apps Agreement;
- banking/tax setup;
- nonzero app price;
- availability territories;
- truthful “one-time paid app, no subscription” metadata.

## 6. In-App Purchases

Optional products:

- non-consumable;
- complete metadata;
- localized display name/description;
- review screenshot where required;
- available in sandbox;
- reachable by reviewer;
- server-verified;
- restorable;
- pending/interrupted/refund/revocation handled;
- not required for core app.

If an IAP is intentionally unavailable, do not submit/advertise it as
available.

## 7. Parent Gate

Required before:

- external websites;
- adult store from child mode;
- purchase/restore;
- account changes;
- leaving child mode;
- sharing.

Review PIN and path must be stated. Gate must not rely on a trivial
knowledge question. Back/restart/deep link cannot bypass it.

## 8. Privacy and account deletion

- Privacy Policy URL active and public.
- Privacy Center inside app.
- Privacy manifest/API reasons generated from exact binary.
- Data collection declarations match SDK/network behavior.
- Account deletion starts in app if account creation exists.
- Public deletion/support URL available where needed.
- Local child profiles removable by parent.

## 9. Screenshots and preview

- Exact submitted RC.
- Correct device dimensions.
- No concept collage.
- No unavailable Disney content.
- No fake prices.
- No generated real writer portraits.
- Optional IAP clearly identified.
- No Android/RuStore/Google Play branding.
- No future functions.
- Source captures and build SHA retained.

## 10. Technical readiness

At release candidate verify current Apple-required Xcode and SDK versions.
Build/archive/upload must use currently accepted tooling.

Test:

- clean install;
- launch;
- no splash flash;
- iPhone/iPad;
- portrait/landscape;
- Dynamic Type;
- VoiceOver;
- Reduce Motion;
- background/resume;
- memory warning;
- StoreKit interruption/restore;
- Universal Links;
- offline bootstrap;
- child cold start;
- account deletion.

## 11. Notes for Review template fields

- Purpose of app.
- Existing probpera.ru globe is reused locally.
- Paid app and included Starter Set.
- Optional non-consumable IAP.
- Child mode and Parent Gate.
- Review account/PIN.
- Exact test product.
- Account deletion.
- External links.
- Disney content absent unless licensed.
- Network/offline behavior.
- Contact and response SLA.

## 12. Submission blockers

- old/unsupported toolchain;
- broken review credentials;
- account creation without deletion;
- IAP not found or not restorable;
- child external link without gate;
- misleading screenshot;
- rights uncertainty;
- incomplete privacy declaration;
- crash/loader;
- blank WebGL;
- unapproved licensed asset;
- unavailable backend.
