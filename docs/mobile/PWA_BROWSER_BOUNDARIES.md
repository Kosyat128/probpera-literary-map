# PWA browser boundaries - S03

Status: partial execution with two failed scenarios and explicit support boundaries, 2026-09-05. This document implements the browser-matrix portion of current routed document `23_PERFORMANCE_RELIABILITY_DEVICE_MATRIX_RU.md`, §7 (line 129). It does not accept S03, certify a release candidate, approve draft RU/EN copy, or replace later device/soak work.

## Evidence already obtained

The historical loopback QA artifact `03c7623ea834f0678fd0602bdc618ddfa836c2e9bd94eaa2ba136214516a67ca`, source checkpoint `8e6cfe1f482ebd261965d774cbf4e14f80f62f1d`, passed the existing 20 Chrome desktop/mobile scenarios with zero failures/skips/flakes. Its recorded duration is 279.563 s, starting `2026-09-05T19:20:35.052Z`. Those scenarios and their artifact remain historical evidence; a new ephemeral signing authority requires a distinct new QA build. Mobile viewport emulation in Windows Chrome does not verify physical Android/iOS hardware.

The separate cross-engine run used fresh QA artifact `4a0696efeabacc2e0d12ddf8989d315b59d79bdfa7495653fa566a5954de0a1c`, source checkpoint `8e6cfe1f482ebd261965d774cbf4e14f80f62f1d`, with source-input digest `799fad9031a0ea5f3bd92ad9c0b35155942f1b5029d8d36e5680444ae07dcb31`. It finished with **4 passed, 2 failed, 0 skipped, 0 flaky**, one worker and no retries, in 122.202 s. The source checkpoint is an ancestor plus recorded working inputs, not an exact RC commit. [Full observations, raw-report hash and independent artifact audit](evidence/S03/cross-engine-browser-first.json).

| Target | Local executable and observed runtime | Current product evidence | Remaining boundary |
| --- | --- | --- | --- |
| System Chrome, Windows x64 | System executable; `browser.version()` = `152.0.7977.76` | Historical 20 above; fresh install/locale/scene scenario passed, cold-offline scenario failed at status indicator | Navigator/transport emulation discrepancy below; native installation unverified |
| Playwright Firefox | Local revision 1538; `browser.version()` = `153.0` | Both fresh scenarios passed, including offline search and RU/EN recovery/support instructions | Patched desktop engine only; branded/native installation unverified |
| Playwright WebKit, Windows | Local revision 2336; `browser.version()` = `26.5` | Fresh install/locale/scene scenario passed; cold-offline navigation failed | Windows engine navigation boundary below; no Safari/macOS/iOS equivalence |
| Branded Safari on macOS | No live Safari runner/device evidence in this task | Unverified | Actual browser, installed web app, storage and recovery checks |
| Safari on physical iPhone/iPad | No live device evidence in this task | Unverified | Add to Home Screen, standalone relaunch, offline core, background/resume and storage behavior |

Descriptor versions are read from `node_modules/playwright-core/browsers.json`. They are not reported as versions that actually executed. Each new run saves `browser.version()`, browser name, native UA/platform, automation-host OS/architecture/release, viewport and capability observations.

Local preparation completed at `2026-09-05T20:04:01Z`: Firefox `firefox-1538/firefox/firefox.exe` and WebKit `webkit-2336/Playwright.exe` exist under checkout `.tmp/browser-engines`. The installer exited 0 and placed its FFmpeg 1011 and Winldd 1007 dependencies in that same directory. The read-only pre-execution inventory is preserved at `../.tmp/literary-planet-v12-intake/S03-cross-engine-browser-inventory.json`, with installation output beside it in `S03-cross-engine-browser-install.log`. Runtime observations above came from the later actual browser run, rather than package descriptors.

The current auditor passed all 335 files (38,354,797 bytes), including 295 bootstrap files (18,415,421 bytes), 919 source inputs, 268 public sources and 39 scripts. This establishes preparation integrity and input freshness; it does not change the two failed browser outcomes. The earlier 20-scenario suite has not run against this new artifact.

## Reproduced execution boundaries

The original six results and failure traces remain unchanged under `.tmp/pwa-cross-engine-results/s03-cross-engine-20260905/`. [Independent transport reproduction](evidence/S03/cross-engine-transport-boundaries.json) compares a tiny cache-only worker with the actual worker runtime, both using the actual `WebPlatformAdapter` on small HTML fixtures. It executes no product build and does not replace either failed scenario with a pass.

- **Chrome 152 / Playwright 1.62.1:** `context.setOffline(true)` first makes `navigator.onLine=false` and the adapter report `offline`. After a new cached document navigation, both report `online`, while an uncached request fails with `net::ERR_INTERNET_DISCONNECTED` and the server receives zero corresponding requests. The discrepancy occurs with both workers. The artifact's offline grant and actual globe loaded, but its status indicator followed the browser's reported state; subsequent search/help assertions in that scenario were not executed. A CDP network-state override before another reload did not survive the new document either. Do not infer network reachability from `navigator.onLine` or turn this emulation result into a product fix without further evidence.
- **Windows WebKit 26.5 / Playwright 1.62.1:** after offline emulation, a new cached EN navigation fails with `WebKit encountered an internal error`; the old RU document remains active. Both the tiny worker and actual runtime reproduce this. The artifact's cold-offline search/help checks remain unverified in this environment. Actual Safari/device behavior requires a separate observed test; this does not establish a Safari defect.

All six artifact observations reported the Windows x64 host, secure context, SW/Cache/SubtleCrypto, a successful temporary local-storage round trip and zero observed external page requests up to completion or failure. Firefox completed both behaviors. Chrome/Firefox storage estimates were available with persistence false; Windows WebKit did not expose those optional storage methods. WebKit's default UA contains Macintosh/Safari while `navigator.platform` is `Win32`; that default string does not change the recorded host or imply a Safari test. All engines ran in browser display mode with no observed install events and no native-installation claim.

## What the two automated scenarios establish

The separate [configuration](../../playwright.pwa-cross-engine.config.mjs) runs [two scenarios](../../tests/pwa/cross-engine-pwa.spec.mjs) for each of Chrome, Firefox and WebKit, one worker, with native desktop defaults. There is no Safari/iPhone user-agent emulation or alternate product/catalog.

1. The actual access boundary accepts an ES256 grant from a fresh in-memory loopback QA authority; the same scoped worker controls the page and its exact build has an activated COMPLETE cache. RU→EN→RU changes route metadata/canonical/hreflang/manifest while preserving the actual document, country and R3F Canvas/renderer/camera/scene objects.
2. A new offline document opens the same core, verifies saved access and runs first-use canonical writer search. The existing RU/EN Help shows storage/offline limits and exact canonical account/deletion `returnTo` links plus the support email. No external account action or email is sent. Recovery instructions and links are tested; a real merchant/session recovery transaction is not implied.

Every run attaches measured secure context, SW/Cache/SubtleCrypto availability, a temporary local-storage round trip, IndexedDB presence, storage estimate/persisted result (or error), display mode, `navigator.standalone`, install-event observations and the actual existing globe's WebGL version/renderer. The probe does not create another canvas and does not request persistent-storage permission.

Missing required core capabilities produce a failed scenario with an `unsupported-environment` annotation and measured evidence. There are no conditional pass branches or skips. Missing browser binaries produce runner failures, not support claims. Optional APIs are recorded separately; API presence, a manifest, an install event, COMPLETE caching and native OS installation are distinct observations.

## Installation and platform interpretation

The term “verified installation” in these scenarios refers to the application Service Worker and verified cache, not an OS shortcut, taskbar app, Add to Dock or Add to Home Screen. Native installation remains `nativeInstallationVerified: false` until separately observed.

Playwright uses patched Firefox/WebKit builds. Its WebKit is not branded Safari, and platform-dependent behavior differs between host operating systems. Windows WebKit results therefore cannot close Safari or iOS/iPadOS requirements. [Playwright browser documentation](https://playwright.dev/docs/browsers) (accessed 2026-09-05).

Do not infer a blanket “Firefox desktop cannot install web apps” limitation from older general PWA guidance. Mozilla documents Windows web apps from Firefox 143, with Microsoft Store support from 150; that feature is not available in private windows. This describes branded Firefox behavior, not successful installation in our patched automation runner. [Mozilla Firefox for Windows web apps](https://support.mozilla.org/en-US/kb/web-apps-firefox-windows) (updated 2026-06-24, accessed 2026-09-05).

Installation UI varies by browser and OS. `beforeinstallprompt` availability is not a portable installation requirement, and browser-tab display mode does not establish standalone operation. [MDN installability guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) (accessed 2026-09-05). Product behavior is measured rather than selected by UA guesses.

## Reproducible isolated session

The [thin QA wrapper](../../tests/pwa/support/cross-engine-server.mjs) delegates to the existing `startPwaQaServer`. It does not change the shared worker, builder or signing semantics. It requires:

- A new lowercase `PWA_CROSS_ENGINE_RUN_ID`, 6-48 characters. Its files are `.tmp/pwa-qa/cross-engine-<id>-authority.json` and `cross-engine-<id>-server.json`.
- The old `dist-pwa` preserved and removed from the build output path by the coordinating task before launch. The wrapper refuses an existing output directory or previously used authority/control/session path. It performs no archival, move or deletion itself.
- An explicit `PWA_CROSS_ENGINE_ALLOW_BUILD=1` at the coordinated fresh-build step. Ordinary config discovery does not start a server/build.
- Browser downloads and lookup scoped to checkout `.tmp/browser-engines`. System Chrome is reused. These commands do not invoke `--with-deps`, replace a system browser or install globally. A missing host dependency would remain an explicit execution blocker.

PowerShell commands, executed from the checkout only after the coordinated checkpoint:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location).Path '.tmp/browser-engines'
$env:PLAYWRIGHT_SKIP_BROWSER_GC = '1'
node node_modules/@playwright/test/cli.js install --no-progress firefox webkit
$env:PWA_CROSS_ENGINE_RUN_ID = 'choose-a-new-unique-run-id'
node tests/pwa/support/cross-engine-server.mjs --inventory
node node_modules/@playwright/test/cli.js test --config playwright.pwa-cross-engine.config.mjs --list
# After the preceding artifact and results are safely preserved:
$env:PWA_CROSS_ENGINE_ALLOW_BUILD = '1'
node node_modules/@playwright/test/cli.js test --config playwright.pwa-cross-engine.config.mjs
```

The shared builder's existing Git safe-directory process configuration still applies on this worktree. Port 4296 is the default; `PWA_CROSS_ENGINE_PORT` can select a free loopback port. A new session writes its public identity and executable inventory to `.tmp/pwa-cross-engine-results/<id>/session.json`, JSON test results to `results.json`, and per-test capability attachments/traces under `artifacts/`. The control token stays in its unique local control file and is not copied into reports; private keys remain in memory. The previous `.tmp/pwa-qa/authority.json`, `.tmp/pwa-qa/server.json`, historical 20-case report and historical artifact are not repurposed.

## Remaining manual and release evidence

Actual Safari/macOS and physical iPhone/iPad must record browser/OS/device/build identities, native installation and standalone launch, authenticated offline cold restart, language/selection preservation, storage deletion/recovery, and account handoff with the exact return route. Browser storage remains best-effort and new remote revocation cannot be observed while offline. Optional covers/audio/packages are not guaranteed by this core probe.

These two scenarios do not cover 20-30-minute soak, thermal budgets, low-memory devices, full orientation/multitasking, all browser versions, all update/rollback branches or the final legal/translation review. Keep those gaps explicit; this document does not convert unavailable hardware or unexecuted capabilities into accepted support.
