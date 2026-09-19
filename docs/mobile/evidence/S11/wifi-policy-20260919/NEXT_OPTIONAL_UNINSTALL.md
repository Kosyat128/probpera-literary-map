# Next S11 implementation: saved optional-package removal

Read-only source review after the Wi-Fi checkpoint. This document records the
remaining implementation gap; it does not claim that uninstall is implemented
or that an additional owner approval is required for programming it.

Document 18 requires optional-package removal while protecting mandatory
bootstrap. Currently `PlanetDownloadsPanel.tsx` protects every saved version,
`contentPackageCache.discard()` removes only unfinished candidates, and both
native plugins refuse removal of selected current/previous generations.

## Authority

Use a trusted app-catalog retention policy with required as the default. Bind
optional permission to the exact adult package scope and approved manifest pins.
Reject conflicting policies for the same scope. Do not accept an arbitrary
optional flag in an uninstall request or derive permission from a URL, title,
namespace or QA status. Keep the signed manifest v1 unchanged unless a separate
protocol migration is justified. Production catalog/trust remain empty.

## Atomic retirement before cleanup

Keep incomplete-candidate discard unchanged. A separate uninstall operation must
compare the exact displayed selection before retiring it atomically. Retain a
small tombstone instead of deleting the selection pointer: absent/installed/
absent creates an ABA race in which an old first-install request can commit.

The local selection protocol must preserve version/high-watermark information
as well as a monotonic retirement epoch. Compatibility reads must retain the
original v1 bytes for hash/CAS comparison. Reinstallation must be an explicit
new intent; it must not silently bypass version or manifest-pin checks.

Capture the operation epoch before asynchronous verification or download. Pass
it through writes, commit and pruning. Web can use the existing download/scope
lock order. Native host locks are only local to one JS host, so the native serial
queue must enforce the epoch before writing or deleting files as well as during
selection CAS. An old host must not recreate bytes after retirement.

Use a separate native retirement method; keep ordinary commit's complete
candidate byte verification. Cleanup may remove only that package's generations.
New current/previous selections and other namespaces remain protected. Reads
should recheck selection after asynchronous verification where another native
host may have retired it meanwhile.

If cleanup fails after the atomic retirement, report unavailable offline content
and incomplete file cleanup truthfully. Preserve a restart-safe retry path.
Neither late cancellation nor a cleanup error can claim the retirement rolled
back. A successful operation must not falsely claim all space was reclaimed.

## UI and bounded validation

Provide RU/EN confirmation bound to the displayed package/version. A changed
selection must require refreshing the state, rather than deleting a newer
version silently. Keep stable keyboard focus and distinguish uninstall from
discarding an unfinished download.

Cover mandatory and adjacent-package protection, current/previous retirement,
explicit reinstall, stale native-host writes, concurrent selection changes,
failure before/after the atomic boundary and cleanup after restart. Use existing
signed QA fixtures, keep their content inactive, and run only affected tests.
Native implementation still requires compilation and subsequent actual-device
validation; source fixtures are not installed-device evidence.

Primary files: `src/planet/ContentDownloads.ts`, `contentPackageCache.ts`,
`contentPackageStorage.ts`, `src/host/PlanetDownloadsPanel.tsx`,
`src/host/nativeContentStorage.ts`, `createNativeContentDownloads.ts`,
`src/platform/adapters/web/WebContentDownloads.ts`, and the Android/iOS
`PlanetContentStorePlugin` implementations.
