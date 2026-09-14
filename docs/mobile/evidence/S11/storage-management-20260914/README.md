S11: storage space and unfinished download removal
================================================

Source: `c0dba72eb23f48eb6e1a0ea92a44e8cd75e4107c`.

The RU/EN Downloads panel now shows available space on request and removes one
unfinished adult download. Current and previous selected versions remain protected,
including when another tab finishes a download while cleanup waits. The mandatory
bootstrap and other package namespaces are outside the removal target. Saved versions
cannot be deleted through this control.

Space measurements are display-only, retained in memory, and never sent to a server.
Browser space is an estimate of the app origin's remaining quota. Native capacity uses
the app's storage volume. Missing, rejected, invalid or timed-out measurements remain
unknown; zero is a valid result. The query times out after five seconds and rejects late
results from an older attempt. It does not reserve space or guarantee download success.

Validation
----------

- 301 unit cases: cache protection, concurrent completion/cancellation, resume after
  removal, quota/provider failures, timeout/retry/disposal, existing lifecycle/adapters.
- 6 actual Chrome cases: HTTP/CacheStorage/Web Locks, two-tab cleanup, RU/EN language
  synchronization, offline removal and reads after browser restart, lifecycle recovery,
  focus/accessibility, and the existing canonical globe/Canvas/renderer/camera/scene.
- TypeScript, platform boundaries and Android Java compilation passed.
- iOS privacy XML parsed successfully. Disk-space reason `85F4.1` is declared for display.
  iOS compilation and execution were not performed.
- Three original-resolution screenshots were visually inspected; paths and hashes are
  in [result.json](result.json).

The first browser attempt exposed an incorrect test locator: switching EN in one tab
also changed the first tab's language. The corrected test passes. A build-helper header
and process-local Git trust setup were corrected before build execution. Failed attempts
and the CRLF-only test-file normalization record remain preserved.

Android artifact
----------------

Local Android **dev/debug**, build `3144732dbc3bb470383ed9c2b35f9477f8103a9a7375348236844482301ff7b3`:

- APK: `D:/CodexData/.codex/visualizations/2026/09/14/01a09fad-fda7-76c3-99f3-acb7a06e1cbc/s11-storage/android-3144732d/app-dev-debug.apk`
- Size: 67,586,005 bytes.
- SHA-256: `fa66d74be6491149b89c1acbe6ae92c62b855398fcc53518e5eb05d8215731dd`.
- Strict runtime, actual APK ZIP/CRC/assets, compiled RU/EN locales, signature,
  alignment, local plugin DEX and exact-copy checks passed. The runtime copy contains
  1,403 files / 72,302,153 bytes. See [Android evidence](android-a1/result.json).
- Previous Android APK and its entire preserved runtime were rechecked and retained.

This APK includes the lifecycle and storage source changes. PWA `c6c50755` remains at
the earlier lifecycle source and does not contain this storage-management slice.
No installed-device or native process-death execution was performed. Production package
descriptors/trust remain empty; synthetic signed packages were used only in tests.
Only S00-S02 are accepted, first-open remains `S03.acceptance`, and release readiness
remains false. D107 final synchronization with the owner's factual archive stays deferred.

Next: the Wi-Fi-only preference and explicit handling of unknown network types, then
one PWA refresh. Continue from [result.json](result.json) and the persistent state.

API references
--------------

- [Browser StorageManager estimate](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate).
- [Android StatFs available bytes](https://developer.android.com/reference/android/os/StatFs#getAvailableBytes()).
- [Apple capacity for requested resources](https://developer.apple.com/documentation/foundation/urlresourcekey/volumeavailablecapacityforimportantusagekey).
- [Apple accessed API reasons](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitype).
