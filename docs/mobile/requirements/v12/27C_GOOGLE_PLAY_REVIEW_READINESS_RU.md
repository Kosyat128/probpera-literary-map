# GOOGLE PLAY REVIEW READINESS — V12

## 1. Paid status before public launch

The production listing must be configured PAID before first public
release. Never use a public free production launch as beta. Use internal
and closed tracks.

Create a preflight proof:

- app status;
- price;
- countries;
- payments profile;
- production release not yet free;
- package name;
- app-signing configuration.

If the package was already offered publicly free, stop and raise an
external owner decision; do not claim it can simply be converted.

## 2. Target audience and content

Complete from the exact release candidate:

- target age groups;
- child-directed features;
- Families applicability;
- ads absence;
- child data practices;
- content rating questionnaire;
- sensitive adult literary themes;
- Parent Gate behavior;
- store and external links.

The declared audience must match screenshots, mascot, wording, journeys,
child profiles and actual UI.

## 3. App access

Provide reusable instructions and credentials for all restricted content:

- review account;
- Parent PIN;
- child mode;
- adult store;
- sandbox purchase;
- Restore;
- account deletion;
- offline package;
- any location/server limitation.

Do not require:

- OTP;
- SMS;
- owner approval;
- QR from another device;
- physical biometrics;
- real payment.

Validate the instructions from a clean install and non-owner network.

## 4. Data Safety and privacy

Build declarations from actual:

- account identifiers;
- purchase verification;
- IP/network processing;
- crash data;
- diagnostics;
- app interactions;
- child profile fields;
- favorites/history;
- support data;
- third-party SDKs.

Privacy Policy:

- public active URL;
- names the developer/app;
- matches Data Safety;
- explains deletion/retention;
- describes child data minimization;
- accessible inside app.

If account creation exists, provide both in-app and public web deletion
paths required by current policy.

## 5. Store listing

- Title within current limit.
- Short/full descriptions factual.
- No “official”, “№1”, guaranteed child development or unavailable
  feature.
- Screenshots from exact AAB RC.
- No concept collage.
- No Disney without license.
- No App Store/RuStore badges.
- Optional purchases disclosed.
- Paid base value explained.
- Contact/privacy/deletion URLs work.

## 6. Technical compliance

At RC recheck:

- current target API requirement;
- current Play Billing requirement/deadline;
- 64-bit/native requirements if applicable;
- Android App Bundle;
- Play App Signing;
- permissions;
- foreground/background behavior;
- broken functionality policy;
- stability/ANR/crash thresholds.

Test:

- clean install/update;
- Android Back;
- App Links;
- low memory;
- offline/slow network;
- WebGL fallback/recovery;
- child boundary;
- Billing pending/restore;
- account deletion;
- large text/TalkBack;
- all supported form factors.

## 7. Permissions

Manifest gate rejects unnecessary:

- location;
- contacts;
- SMS/call log;
- microphone;
- camera;
- broad storage;
- advertising ID;
- background location;
- unrelated notification permission.

Every sensitive permission needs declaration, in-context explanation and
functional denial path.

## 8. Billing

- Optional one-time non-consumable products only.
- Real localized prices.
- Backend purchase token verification.
- Pending purchase handling.
- Acknowledgement after entitlement delivery.
- Restore/requery.
- Refund/revocation.
- Test/prod separation.
- No native link to cheaper web digital purchase unless current policy and
  owner/legal review explicitly permit it.

## 9. Child mode

- No ads.
- No prices/Buy CTA.
- Store behind Parent Gate.
- Separate search/cache/history/offline data.
- Exact-age per-work access.
- Adult content never flashes at startup.
- Disney and protected characters absent without license.
- No third-party behavioral profiling.

## 10. Submission blockers

- public free status for intended paid package;
- inaccessible restricted content;
- mismatched Data Safety;
- incorrect target audience;
- adult content reachable in child mode;
- excessive permissions;
- old target API/Billing;
- misleading screenshots;
- broken account deletion;
- crashes/ANRs/blank globe;
- unauthorized IP;
- store link policy violation.
