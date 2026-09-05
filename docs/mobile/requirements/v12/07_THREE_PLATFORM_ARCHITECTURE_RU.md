# THREE-PLATFORM CONTRACT

## Платформа 1 — Web/PWA

### Product

- installable app;
- app-like navigation;
- responsive phones/tablets/desktops;
- local app shell;
- canonical globe/content;
- offline bootstrap;
- safe updates;
- canonical links to site articles.

### Technical

- separate controlled build artifact;
- manifest + icons;
- isolated service-worker scope;
- no conflict with main site cache;
- CSP/no remote executable code;
- versioned cache;
- atomic activate/rollback;
- Playwright/Lighthouse/accessibility;
- browser fallback when install unsupported.

### Deliverables

- production bundle;
- deployment package;
- manifest;
- service worker;
- integrity manifest;
- PWA install test;
- offline test;
- rollback guide;
- WebPlatformAdapter;
- WebPurchaseProvider state contract.

## Платформа 2 — Android

### Variants

- `dev`;
- `googlePlay`;
- `ruStore`.

### Common

- local bundled runtime;
- App Links;
- Android Back;
- edge-to-edge/safe insets;
- secure storage;
- filesystem;
- lifecycle/background/resume;
- network status;
- low memory;
- adaptive icons;
- exact orange splash;
- minimum permissions.

### Google Play

- current Play Billing;
- pending state;
- backend verification;
- acknowledgement;
- restore/query on launch/foreground;
- Google Play AAB.

### RuStore

- current RuStore Pay SDK;
- do not use deprecated BillingClient;
- separate provider/config/flavor;
- current console/signature requirements;
- server verification/notifications;
- RuStore release artifact.

### Deliverables

- Android project;
- debug/QA APK;
- Google Play AAB;
- RuStore artifact;
- Gradle tests;
- signing guide;
- store configs.

## Платформа 3 — iOS/iPadOS

### Common

- local bundled runtime;
- iPhone + iPad adaptive UI;
- Universal Links;
- safe areas;
- Keychain/secure storage;
- filesystem;
- lifecycle/memory warning;
- exact orange launch;
- Dynamic Type;
- VoiceOver;
- privacy manifest.

### Store

- current StoreKit;
- non-consumables;
- restore/current entitlements;
- pending/interrupted transaction handling;
- server verification/notifications where appropriate.

### Deliverables

- Xcode project;
- simulator build;
- tests;
- archive/export config;
- archive/IPA when signing available;
- signing guide;
- App Store metadata.

## Cross-platform parity

- one shared domain;
- one globe semantics;
- one child policy;
- one catalog ID;
- one entitlement model;
- one content manifest schema;
- one source/provenance contract;
- platform-specific payment adapter only.

## Current requirements

Exact target SDK, deployment target and library versions must be rechecked
against official documentation at implementation and again at RC time.
Do not hardcode this package’s date as permanent truth.
