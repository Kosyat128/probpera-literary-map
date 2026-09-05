# OFFICIAL REQUIREMENTS SNAPSHOT — 2026-09-03

This is a dated preparation snapshot, not a permanent pin. Codex MUST open
current official documentation at Stage 0 and again immediately before
Release Candidate/submission. Current official requirements override stale
numbers in this package and every difference must be recorded in:

`docs/mobile/OFFICIAL_REQUIREMENTS.md`

## 1. Repository snapshot

Observed during package preparation:

- repository: `Kosyat128/probpera-literary-map`;
- branch: `main`;
- observed SHA: `e073b21acfea854b3b573aa4613215156957ff38`;
- branch protected;
- required status observed: `verify`;
- Node 24.x / npm 11.x;
- React + TypeScript + Vite;
- Three.js + React Three Fiber;
- existing CMS, rights/evidence, book, portrait and globe release gates.

Codex must re-read the actual current main, open PRs, branch protection and
CI. This snapshot is provenance, not a base pin.

## 2. Apple — observed current requirements

Official Apple “Upcoming Requirements” states that since April 28, 2026,
apps uploaded to App Store Connect must be built with Xcode 26 or later
using the iOS 26/iPadOS 26 SDK or later.

Apple also introduced an updated age-rating system reflected on OS 26 and
requires the current age-rating questions to be completed for submissions.

Observed moderation-relevant principles from official Apple documentation:

- app name and subtitle are each limited to 30 characters;
- a privacy policy URL is required for iOS;
- metadata/screenshots must be truthful and avoid irrelevant trademarked
  terms or unverifiable claims;
- restricted/account functionality must be accessible through a working
  demo account or full demo mode and backend services must be available;
- parental gates are required for purchases and external link-outs in
  Kids Category experiences;
- age rating must be completed and applies to the application submission;
- account deletion must be offered in-app when the app supports account
  creation;
- In-App Purchase must be reviewable and restorable as applicable.

Codex must recheck the exact Xcode point release accepted by App Store
Connect when building the archive.

Official sources:
- https://developer.apple.com/news/upcoming-requirements/
- https://developer.apple.com/app-store/submitting/
- https://developer.apple.com/app-store/review/guidelines/
- https://developer.apple.com/kids/
- https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/
- https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating

## 3. Google Play — observed current requirements

Official Google Play target-API documentation states that starting
August 31, 2026, new apps and updates must target Android 16 / API level 36
or higher for ordinary phone/tablet apps.

Observed Play Billing release notes list Google Play Billing Library 9.1.0
released June 18, 2026. Codex must verify the current required/supported
version and deadlines at Release Candidate rather than assuming 9.1.0 is
permanent.

Moderation-relevant principles:

- intended paid app must be configured paid before first public release;
- restricted functionality must have reusable App Access instructions;
- target audience and child-directed experience must be declared
  accurately;
- Data Safety must match actual code/SDK/network behavior;
- privacy policy must be accessible;
- an app that allows account creation must provide deletion in-app and an
  external deletion URL;
- current target API and Billing requirements must pass;
- screenshots and descriptions must match actual functionality;
- optional digital products use the approved Play purchase mechanism
  unless an applicable current alternative program is explicitly used.

Official sources:
- https://support.google.com/googleplay/android-developer/answer/11926878
- https://developer.android.com/google/play/billing/release-notes
- https://developer.android.com/google/play/billing/integrate
- https://developer.android.com/google/play/billing/security
- https://support.google.com/googleplay/android-developer/answer/10144311
- https://support.google.com/googleplay/android-developer/

## 4. RuStore — observed current requirements

Official RuStore publication documentation states:

- app name: up to 30 characters and unique;
- short description: up to 80 characters;
- detailed description: up to 4000 characters;
- mobile screenshots are mandatory;
- 1–10 screenshots may be uploaded;
- screenshot technical requirements must be rechecked at submission;
- developer email is required;
- app age marking and minimum Android version are declared.

RuStore review guidelines state:

- the app must be stable and all declared functions must work;
- a simple website redirect/WebView-only product is insufficient;
- a complete standalone product is expected;
- test credentials must be supplied for limited/restricted functionality;
- version freshness relative to other stores matters;
- the RuStore build should direct updates through RuStore;
- third-party IP may be checked and evidence requested;
- links to competing app stores/storefronts are prohibited;
- sensitive permissions require justification and prohibited permissions
  cause rejection;
- an app without free functionality must be labeled paid;
- listing and installed names must match;
- screenshots must reflect actual current functionality, not only artwork
  or future features.

For optional purchases use the current RuStore Pay SDK and recheck
merchant, signature, moderation and server-verification requirements.

Official sources:
- https://www.rustore.ru/help/en/developers/publishing-and-verifying-apps/app-publication
- https://www.rustore.ru/help/en/developers/publishing-and-verifying-apps/requirement-apps
- https://www.rustore.ru/help/en/developers/publishing-and-verifying-apps/app-publication/new-version-app/declare-app-permissions/how-to-declare-permissions
- https://www.rustore.ru/help/en/sdk/pay
- https://www.rustore.ru/help/developers/publishing-and-verifying-apps/app-publication/testing

## 5. Capacitor / cross-platform

Recheck current official Capacitor major, minimum Android/iOS versions,
native build prerequisites, plugin support and PWA behavior:

- https://capacitorjs.com/docs

The existing React/Three.js globe remains canonical. Capacitor is a native
shell/adapter layer, not a new globe engine.

## 6. Web/PWA and accessibility

Recheck:

- manifest/installability;
- Service Worker lifecycle/update;
- WCAG/WAI;
- platform payment/consumer law;
- account deletion;
- privacy/cookie obligations;
- accessible offline and error states.

Sources:
- https://developer.mozilla.org/docs/Web/Manifest
- https://developer.mozilla.org/docs/Web/API/Service_Worker_API
- https://www.w3.org/WAI/
- https://web.dev/learn/pwa/

## 7. Required snapshot output at RC

Codex must create:

```text
reports/moderation/common/official-requirements-snapshot.json
```

For each requirement record:

- store/platform;
- official source;
- access date;
- exact requirement;
- effective date;
- selected implementation/tool version;
- evidence;
- status;
- recheck deadline.

A release cannot rely solely on this 2026-09-03 file.

## 8. V12 owner-minimal and jurisdictional additions

### Apple DSA trader status

App Store Connect requires a trader-status declaration. For EU
distribution, trader contact information may be verified and displayed on
the product page. V12 generates the factual worksheet, but the owner/legal
representative performs the legal self-assessment and account verification.

### Apple export compliance

V12 generates an encryption inventory and questionnaire draft. If the app
uses only operating-system-provided encryption, App Store Connect
documentation may not be required. Industry-standard encryption outside
the operating system may require a French declaration when distributing
in France; proprietary encryption may additionally require CCATS. The
final determination remains owner/legal responsibility.

### Apple privacy APIs

The exact archive is audited for PrivacyInfo.xcprivacy manifests and
Required Reason API declarations. App Privacy answers are compared with
the Xcode privacy report and actual backend traffic.

### Android developer verification

V12 records package names and signing certificate associations. The
observed official rollout activates new verification protections on
2026-09-30 in Brazil, Indonesia, Singapore and Thailand, with broader
expansion planned. Recheck before enabling those territories.

### Official API automation

- Apple App Store Connect API can automate many metadata, IAP, TestFlight,
  provisioning and submission operations; new app records and some
  agreements/compliance steps remain account/console actions. Build upload
  uses a currently supported Apple upload path.
- Google Play Publishing API transactional edits can upload artifacts,
  update tracks/listings and remain uncommitted until explicitly committed.
- RuStore Public API supports selected draft/version/asset operations,
  subject to account and app prerequisites.

V12 implements dry-run/draft-only automation by default and never performs
production submission or release without explicit owner authorization.

### Child privacy jurisdictions

V12 adds a territory-specific child privacy gate:

- United States / COPPA;
- EU Member-State consent thresholds;
- France age-15 consent snapshot for applicable processing;
- UK Children's Code;
- local legal review for every additional territory.

SAFE_PAID_BILINGUAL_V1 keeps child profiles local and disables child accounts,
uploads, advertising and behavioural analytics by default.

## 9. V12 bilingual English localization requirements

V12 treats Russian and English as two required production locales, not as
one source language plus an optional partially translated interface.

Apple observations from current official documentation:

- App Store metadata can be localized by language/locale.
- The primary language is the fallback when no better localization matches.
- App Store language selection can be affected by storefront, device
  language, available localizations and the configured primary language.
- Metadata localization and binary localization are separate workstreams.
- App name, privacy URL, descriptions, keywords, screenshots and previews
  must be managed in the relevant localized fields.
- Apple supports per-app language selection on iOS/iPadOS.
- Localized screenshots/previews should be supplied where the user-facing
  language differs; otherwise the next available localization may be used.

Google/Android observations:

- Google Play Developer API supports localized listings identified by BCP
  47 language tags and transactional edit workflows.
- English and Russian listing records and images must be generated and
  validated independently.
- Android supports per-app language preferences and LocaleConfig.
- Complete default resources are mandatory so an unsupported locale cannot
  crash or expose raw keys.

RuStore observation:

- RuStore review guidance requires an application to use Russian or English,
  or to provide a switch to one of those languages. V12 provides both and
  preserves a Russian-first moderation dossier.

Required V12 output:

```text
ru app binary/resources/content/search/audio/offline/store/legal/support
+
en app binary/resources/content/search/audio/offline/store/legal/support
```

The English release is blocked by a missing critical translation, guessed
writer/work title, mixed-language child screen, untranslated legal or
purchase text, stale content hash, wrong localized screenshot, incomplete
search alias, absent English offline package, or reviewer instructions that
do not match the labels in the exact submitted build.

The dedicated source registry is:

`140_OFFICIAL_LOCALIZATION_SOURCES_2026-09-03.json`
