# STORE, CUSTOMIZATION AND PURCHASES — V12 BINDING SPEC

## 1. Непереговорная модель

Приложение является платным до установки/полного доступа.

```text
distributionModel = PAID_UPFRONT_WITH_OPTIONAL_NON_CONSUMABLES
```

Это не freemium и не free-to-download.

Основной доход:

1. Разовая покупка Base Edition.
2. Необязательные non-consumable дополнения.
3. Лицензированные character packs после получения прав.

Запрещены:

- подписки в V1;
- реклама;
- consumable currency;
- coins/hearts/gems;
- loot boxes;
- energy/lives;
- случайные платные награды;
- платный доступ к базовым писателям;
- платный child mode;
- ложные скидки;
- urgency/countdown;
- dark patterns.

## 2. Базовая покупка и optional IAP разделены

### BaseAppEntitlement

Пользователь получает его через:

- paid App Store download;
- paid Google Play download;
- paid RuStore download;
- verified one-time Web/PWA license;
- approved promo/family-sharing mechanism.

BaseAppEntitlement открывает:

- каноническую Литературную планету;
- базу стран/писателей/произведений;
- поиск;
- коллекцию;
- child mode;
- Parent Center;
- Планетку;
- Starter Set;
- базовый offline package.

### OptionalItemEntitlement

Пользователь получает его через отдельную non-consumable покупку.

Он относится только к:

- дополнительному skin;
- stand;
- background;
- accessory;
- StoryWorld;
- bundle;
- licensed character pack.

BaseAppEntitlement не должен зависеть от optional item.
Optional entitlement не заменяет paid app purchase.

## 3. Platform distribution

### App Store

- app price ненулевая;
- Paid Apps Agreement принят;
- app price настраивается в App Store Connect;
- optional products — non-consumable IAP;
- StoreKit provider;
- transaction updates;
- current entitlements;
- server verification;
- restore;
- refund/revocation;
- Family Sharing только после owner decision и тестирования.

### Google Play

- приложение отмечено paid до первого production publication;
- никогда не публиковать free production listing;
- если app уже public free под тем же package name, paid conversion
  блокируется и требуется owner decision/new package;
- internal/closed testing используется до production;
- optional products — one-time non-consumable;
- Google Play Billing;
- backend purchase-token verification;
- acknowledge после verified delivery;
- pending purchases;
- refunds/revocations;
- paid app Family Library eligibility не равна sharing IAP.

### RuStore

- application type = paid;
- monetization подключена;
- app price задана;
- separate RuStore flavor;
- optional products — непотребляемые;
- current Pay SDK;
- deprecated BillingClient запрещён;
- server notifications/API;
- test payment flow после требуемой moderation;
- EDS/merchant prerequisites документируются;
- app purchase и optional item purchase являются отдельными продуктами.

### Web/PWA

- public site остаётся доступен;
- full PWA требует one-time license;
- approved PSP;
- backend receipt/license verification;
- account recovery;
- refund flow;
- tax/consumer disclosure;
- no fake checkout;
- native clients не рекламируют web purchase для обхода store policy.

## 4. Default price planning

Runtime не содержит hardcoded base app price.

При отсутствии owner override использовать planning anchor:

```text
App Store / Google Play: nearest allowed price point to USD 9.99
RuStore: 899 RUB
Web/PWA: 899 RUB or localized equivalent
```

Это default для store-preparation и unit economics. Перед submission:

- получить актуальные price points;
- учесть local currencies;
- учесть VAT/tax;
- учесть store fee;
- проверить territory availability;
- записать owner-approved final price.

Optional original cosmetics:

- price определяется product class и store price point;
- не делать микротранзакции ради каждого мелкого элемента;
- предпочитать тематические bundles;
- licensed packs получают цену только после royalty/contract model.

## 5. Starter Set

Starter Set входит в цену и не имеет IAP SKU.

Минимум:

- все текущие production-ready canonical globe editions;
- child educational globe;
- cheerful Planetka;
- 4 stands;
- 5 backgrounds;
- original Planetka;
- child mode;
- 6 rights-cleared StoryWorld;
- base offline package.

Admin/catalog должен иметь:

```text
commercialAvailability = INCLUDED_IN_BASE
```

Included item:

- не показывает цену;
- не требует restore IAP;
- не может стать paid update;
- доступен после valid base entitlement;
- должен иметь checksum/asset version;
- может быть удаляемым download, но право остаётся.

## 6. Catalog model

Каждый item:

- stable internal ID;
- type;
- RU/EN title/description;
- productClass;
- commercialAvailability;
- includedInBase;
- preview asset;
- runtime assets by quality tier;
- version/checksum/bytes;
- childSafe;
- exact age policy;
- supported platforms;
- supported territories;
- supported globe modes/editions;
- compatible stands/backgrounds/accessories;
- rights/provenance;
- platform product IDs;
- family-sharing policy;
- minimum app version;
- publish status;
- rollback asset;
- accessibility label;
- license expiry;
- post-term policy;
- refund policy.

## 7. Item states

```text
draft
blocked-rights
hidden
included-in-base
available-to-buy
purchase-starting
store-pending
store-success-unverified
verifying
owned
download-required
downloading
downloaded
installed
active
update-available
incompatible
revoked
expired-license
asset-error
fallback-active
```

Included, owned, downloaded, installed и active — разные состояния.

## 8. Preview transaction

1. Сохранить exact current composition.
2. Проверить preview visibility.
3. Проверить child policy.
4. Проверить rights/territory.
5. Проверить entitlement или разрешённый preview.
6. Проверить compatibility.
7. Загрузить минимальный suitable tier.
8. Проверить checksum.
9. Применить temporary composition.
10. Сохранить тот же Canvas/camera/selection.
11. Разрешить rotate/inspect.
12. Apply разрешён только для included/owned installed item.
13. Close/Error возвращает exact previous composition.
14. Temporary resources освобождаются.
15. Only latest preview wins.

Preview не выдаёт entitlement и не запускает purchase автоматически.

## 9. Purchase pipeline

```text
Catalog item
→ platform product lookup
→ localized price
→ adult/Parent Gate
→ system checkout
→ store result
→ backend verification
→ idempotent entitlement
→ acknowledge/complete where required
→ asset download
→ checksum/signature verification
→ install
→ apply
```

Нельзя grant после client-only callback.

## 10. Server authority

Backend проверяет:

- platform;
- environment;
- package/bundle ID;
- internal catalog mapping;
- product ID;
- transaction uniqueness;
- purchase state;
- purchaser/store account signal where available;
- refund/revocation;
- territory;
- license validity;
- family-sharing source;
- idempotency;
- entitlement version.

Secrets только server-side.
Receipt/token redacted.
Test и production environments разделены.

## 11. Restore and lifecycle

Handle:

- pending;
- interrupted purchase;
- app killed during checkout;
- callback after restart;
- network loss;
- duplicate callback;
- already owned;
- reinstall;
- new device;
- store account change;
- restore;
- family-shared entitlement;
- family-sharing revocation;
- refund;
- chargeback;
- license expiry;
- delisted product;
- asset update;
- incompatible app version.

Base paid app purchase восстанавливается через store re-download.
Кнопка «Восстановить покупки» восстанавливает optional IAP.

## 12. Child-commerce policy

В child mode:

- no price;
- no Buy CTA;
- no discount;
- no paid carousel;
- no ad;
- no purchase pressure;
- no adult item;
- no Disney item without license;
- only included/owned child-safe items.

Действия:

- «Выбрать»;
- «Загрузить»;
- «Применить»;
- нейтральное «Спросить взрослого» без цены.

Parent Gate требуется для:

- открытия adult store;
- purchase;
- restore;
- external legal links;
- account changes.

Системные Family Link/Ask to Buy механизмы дополняют, но не заменяют
внутренний Parent Gate.

## 13. Disney packs

Disney item всегда начинается как:

```text
legalStatus = LICENSE_REQUIRED
publishStatus = BLOCKED
storeVisibility = HIDDEN
skuStatus = DISABLED
```

До signed license запрещены:

- production asset;
- preview;
- SKU;
- price;
- marketing image;
- store keyword;
- logo;
- dialogue/voice/music;
- AI imitation.

После лицензии item проходит:

1. Legal scope validation.
2. Asset approval.
3. Child review.
4. Territory mapping.
5. Platform mapping.
6. Sandbox SKU.
7. Server verification.
8. Licensor approval.
9. Store review.
10. Controlled rollout.

## 14. Family use

- app base purchase может использовать store family mechanisms;
- фактическая availability проверяется на каждой платформе;
- Google Play IAP не обещать shareable;
- Apple non-consumable Family Sharing включать только после owner approval;
- RuStore/Web sharing не обещать без механизма;
- child local profiles доступны на licensed installation;
- entitlement revocation обрабатывается без потери child local data.

## 15. Admin

Owner может без runtime-code edits:

- управлять Starter Set;
- создать optional item;
- создать bundle;
- добавить platform SKU;
- назначить included/purchase/licensed status;
- загрузить preview/runtime tiers;
- указать checksum;
- указать rights;
- назначить age/child policy;
- указать territory;
- указать license term;
- указать family-sharing policy;
- publish/unpublish;
- rollback;
- delist;
- revoke.

Publish fail-closed при отсутствии:

- asset;
- checksum;
- rights;
- product mapping;
- preview;
- compatibility;
- child review;
- territory;
- license term;
- post-term policy.

## 16. Store UX

- educational content remains primary;
- one dominant CTA;
- real localized price;
- included item: «Входит в приложение»;
- paid owned: «Куплено»;
- not downloaded: «Загрузить»;
- downloaded: «Установить»;
- installed: «Применить»;
- active: «Используется»;
- no generic black game store;
- canonical violet surfaces/orange action;
- no orange border around every card;
- large text;
- accessibility;
- loading/empty/offline/unavailable/retry;
- platform scope disclosure;
- download size;
- child-safe label;
- rights/license disclosure where relevant.

## 17. Release blockers

Block production when:

- app configured free;
- Google public free listing occurred;
- Starter Set incomplete;
- core feature requires IAP;
- child mode requires IAP;
- hardcoded price;
- optional item lacks restore/verification;
- subscription/consumable appears;
- unlicensed Disney asset present;
- child UI exposes price;
- licensed pack lacks expiry/refund policy.
