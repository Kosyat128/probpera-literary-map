# PAID APP COMMERCIAL MODEL V12 — BINDING CONTRACT

## 1. Commercial thesis

«Литературная планета — Проба пера» продаётся как законченная премиальная
образовательная программа, а не как бесплатная оболочка с обязательными
доплатами.

Primary revenue:
- paid app / one-time web license.

Secondary revenue:
- optional non-consumable cosmetic and StoryWorld packs.

Conditional revenue:
- licensed Disney/other character packs after signed rights.

Excluded:
- ads;
- subscription;
- consumable currency;
- data monetization;
- child-targeted upsell;
- pay-to-learn.

## 2. Value promise

The base purchase must be clearly worth its price on day one.

It includes:
- canonical globe;
- verified literary archive;
- search;
- country/writer/work journeys;
- offline core;
- child mode;
- Parent Center;
- Планетка;
- Starter Set;
- multiple StoryWorld;
- accessibility;
- content corrections.

No optional purchase is necessary to complete the main product.

## 3. Platform-specific paid model

| Platform | Base transaction | Optional products | Required store state |
|---|---|---|---|
| App Store | Paid app | Non-consumable IAP | Paid Apps Agreement + nonzero price |
| Google Play | Paid app | One-time non-consumable | Paid before first public production release |
| RuStore | Paid app | Non-consumable via Pay SDK | Application type Paid + monetization |
| Web/PWA | One-time web license | One-time add-ons | Verified PSP/backend entitlement |

## 4. No-free-publication invariant

Production release is blocked if native application is listed free.

Google Play receives a dedicated guard because a listing that has been
offered free cannot later be switched to paid under the same package name.

Use:
- internal testing;
- closed testing;
- TestFlight;
- RuStore test/moderation;
- promo/test accounts.

Do not use a public free release as beta.

## 5. Pricing architecture

Price is external store configuration, not UI constant.

Config/data:
- desired base anchor;
- store price point;
- currency;
- tax category;
- availability;
- effective date;
- owner approval;
- source snapshot.

Fallback planning anchors:
- USD 9.99 equivalent for App Store/Google Play;
- 899 RUB for RuStore;
- 899 RUB equivalent for Web/PWA.

Before submission:
- recheck official ranges;
- recheck fee;
- recheck taxes;
- recheck country availability;
- record final owner choice.

## 6. Unit economics

For every platform and optional pack:

```text
estimatedNet =
grossPrice
- indirectTaxes
- storeOrProcessorFee
- licensorRoyalty
- refundsAndChargebacksReserve
- currencyConversion
- contentDelivery
- supportReserve
- assetAmortization
```

Never store commission percentages as timeless product truth.
Snapshot official terms at release candidate.

## 7. Disney economics

A Disney pack cannot be priced before:

- license structure;
- permitted product model;
- royalty base;
- minimum guarantee;
- reporting;
- approval costs;
- territories;
- languages;
- term;
- marketing rights;
- refund/post-term obligations.

Disney packs remain hidden until finance + legal + rights gates pass.

## 8. Platform scope disclosure

Default:
- purchase is platform-specific;
- no “buy once everywhere” promise;
- progress may sync;
- entitlements may sync only after policy/legal approval;
- web license does not grant store download;
- store purchase does not grant web license by default.

Disclose before optional purchase.

## 9. Refund and revocation

Create a unified internal model while respecting each platform.

Handle:
- paid app refund where observable;
- optional product refund;
- chargeback;
- family-share revocation;
- license expiry;
- product delisting;
- asset corruption;
- accidental duplicate.

Do not delete user-created child profiles/favorites because one optional
entitlement is revoked.

## 10. Commercial analytics

Adult store only:
- catalog view;
- preview;
- purchase start;
- system result;
- verification;
- install;
- apply;
- restore;
- error category.

Do not:
- track child purchase interest;
- profile children;
- send raw search text;
- use ad IDs;
- pressure users based on analytics.

## 11. Store positioning

Store listing must say:

- one-time paid application;
- no subscription;
- no ads;
- large included starter set;
- optional additional themes;
- child mode included;
- parent controls included;
- literary data verified;
- Disney packs only if actually licensed and available.

Do not show unavailable Disney content in screenshots or description.

## 12. Final commercial evidence

Create:
- pricing matrix;
- unit economics;
- paid-status screenshots;
- agreement status;
- tax/compliance checklist;
- product SKU export;
- optional IAP sandbox evidence;
- refund/restore evidence;
- Disney rights-gate report;
- Starter Set completeness report.
