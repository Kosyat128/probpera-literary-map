# SAFE FIRST RELEASE PROFILE — V12 BINDING CONTRACT

## 1. Profile ID

```text
releaseProfile = SAFE_PAID_BILINGUAL_V1
```

This is the default first-public-release profile unless the owner approves
a stricter or broader profile after all gates pass.

## 2. Included

- canonical site Literary Planet;
- paid Base Edition;
- complete Starter Set;
- adult literary archive;
- child mode;
- Parent Center;
- Planetka;
- offline bootstrap;
- real approved portraits and flags;
- verified biographies and works;
- included skins, stands and backgrounds;
- original/cleared StoryWorlds;
- one optional original non-consumable product when review-ready;
- accessibility;
- Russian localization;
- English only when complete.

## 3. Disabled by default

- Disney/Pixar and all other unlicensed IP;
- cloud account/sync unless deletion/privacy/reviewer access all pass;
- push notifications;
- behavioural analytics;
- advertising;
- microphone;
- camera;
- location;
- contacts/SMS/call log;
- social/UGC/chat;
- alternative payment links in native clients;
- subscriptions;
- consumable currency;
- unfinished locale;
- experimental graphics;
- remote executable code;
- unpublished optional SKUs;
- AR and other nonessential first-release features.

## 4. Optional IAP policy

Codex selects one original product after evidence review.

Preferred:

```text
original.background.premium-library
```

Fallback:

```text
original.stand.book-stack-premium
```

Requirements:

- rights owned;
- no sensitive content;
- no licensed character;
- small download;
- high visual quality;
- all quality tiers;
- reversible preview;
- server verified;
- restore/refund/revocation;
- child hidden;
- store screenshots and reviewer path ready.

If one store cannot complete the product setup, that platform may ship
the paid Base Edition without active IAP only when:

- all IAP code remains complete;
- store tab does not make a false promise;
- no empty product category;
- owner approves the platform-specific first-release configuration;
- the discrepancy is documented.

## 5. Account policy

Native:

- guest-first;
- local profiles;
- no mandatory sign-in;
- account feature flag off by default.

Web/PWA:

- minimum identity necessary for paid entitlement;
- no child account;
- deletion/recovery/support;
- no social login unless necessary.

If existing auth is already production-ready, Codex may enable it only
after all account deletion, privacy, review access and reliability gates.

## 6. Localization

Required for first release:

- Russian app UI;
- Russian legal/support/store materials where store requires;
- English reviewer instructions;
- English UI only if 100% complete and tested.

No mixed-language screen.
No machine translation published without review.
No incomplete locale in store listing.

## 7. Territory policy

Public launch uses `SAFE_INITIAL`, not all storefronts by default.

A territory is included only when:

- store sales available;
- legal seller can sell there;
- price/tax/trader status ready;
- app language/support adequate;
- content and assets rights allow it;
- privacy/legal URLs apply;
- child/audience declarations complete.

## 8. Release mode

- manual release after approval;
- staged rollout where the store supports it;
- no automatic worldwide release;
- exact RC frozen;
- optional product kill switch;
- no core paid-app kill switch;
- 72-hour launch monitoring.

## 9. Profile acceptance

Fail if:

- any disabled feature remains visible;
- disabled SDK still collects data;
- unlicensed asset remains bundled;
- unfinished locale remains selectable;
- account appears without deletion;
- optional product appears without store readiness;
- child sees price/Buy;
- external native checkout appears;
- core value depends on network/account/IAP.
