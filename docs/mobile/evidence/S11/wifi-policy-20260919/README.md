# S11 Wi-Fi policy and interrupted globe gesture recovery

Source: `7f6f280256d16e33901e65826814adb8401ed5c2`.

RU/EN downloads now persist a Wi-Fi-only preference. Fresh, explicit network
types control transfers; unknown types do not grant Wi-Fi permission. Changing
the preference or connection stops transfers and preserves verified files.
Resuming remains explicit. Offline storage controls remain usable when preference
storage fails. Native background/resume invalidates stale connection types.

A manual globe gesture interrupted by backgrounding now ends exactly once,
allowing autorotation to resume without replacing the scene or camera.

## Validation

- 171 platform capability units and 108 preference/controller units passed once.
- Five source Chrome cases cover network transitions, persistence, recovery,
  lifecycle and the canonical globe; one actual-built PWA case covers cold
  offline RU/EN, preference persistence and storage estimates.
- Final TypeScript and platform-boundary checks passed. The first TypeScript
  failure is retained in `static-a1`; the corrected Navigator annotation emits
  identical JavaScript. Globe LF normalization also preserves emitted code.
  These corrections did not require repeating passing runtime suites.
- Four original-resolution screenshots were inspected, including both narrow
  PWA locales. Their identities are recorded in `result.json`.
- `checkpoint-validation.json` confirms 342 requirements, 107 bilingual
  requirements, only S00-S02 accepted and first-open S03.acceptance.

## Preserved artifacts

Both artifacts include lifecycle, storage and Wi-Fi controls. Exact prior
versions remain preserved. The authoritative paths and complete digests are
in the individual artifact reports.

| Artifact | Build | Evidence |
| --- | --- | --- |
| Local-QA PWA | `d1e90c35` | `pwa-a1/result.json` |
| Android dev APK | `b2f77958` | `android-a1/result.json` |

PWA: 1,422 files / 74,232,966 bytes. Android APK: 67,587,888 bytes;
runtime: 1,403 files / 72,308,372 bytes. Android build, strict runtime,
ZIP/CRC/assets, DEX, locale, signature and alignment checks passed.

Actual native execution/process-death and iOS compilation remain unverified.
QA data is inactive, production package descriptors/trust remain empty,
stage acceptance and release readiness remain false. No external publication
or production action occurred. D107 final archive synchronization stays deferred.

Next internal gap: removing a fully saved optional package. Implement a separate
user-confirmed uninstall with trusted optional classification and atomic
retirement; preserve mandatory bootstrap and existing incomplete-download
cleanup protections. Retained tombstones/operation fencing are required to
prevent concurrent native writers from recreating removed packages.
