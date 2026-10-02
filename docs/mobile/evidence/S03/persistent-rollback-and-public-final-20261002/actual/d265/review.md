# D265: persisted rollback across an offline browser restart

External proposal only; no checkout changes or test/build/browser execution by the author.
Active route remains S03.acceptance (PLATFORM-001 and CONTENT-007). All acceptance/approval/release states stay unchanged.

## Exact scope

One existing owner: tests/pwa/controlled-pwa.spec.mjs. The exact original bytes remain the full prefix; one independent case is appended. No earlier case is selected or rewritten.
Selected title: explicit rollback survives a full persistent browser restart offline under the newer worker engine
Runtime config has one controlled-pwa file, one suffix-anchored title, one msedge project, one worker, zero retries, no webServer and no build command. Missing current-source HEAD or differing spec bytes rejects configuration.

## Real A/B generation proof

Use the original current QA artifact A, created under the SAME live local QA authority as the server. This is a private controlled paid-PWA artifact, not a release candidate or public-site build.
The existing local-server candidate operation derives B from actual A executable bytes: it appends its QA generation comment to the existing essential .js, updates its digest/size and module-ownership records, and bundles the existing worker against the new manifest/rollback anchor. This is not a second Vite compilation or a second product version.
Observe both actual COMPLETE markers and their activation sequences; B must anchor the authenticated A manifest. Probe the changed executable served under B and prove its actual SHA differs from A. Use the real product update and rollback buttons. Then prove B is still the worker engine, with A selected and A executable SHA/size served.
Record the bounded persisted __pwa_selection__ from B's cache (JSON and SHA) before closing. Keep both generation caches and the same profile; never reset/reprepare/clear them between phases.
Close the persistent context (closing its browser), then launch the same owned disposable profile with offline:true before its first navigation. A blank page performs real navigation before any executable probe, allowing the worker to bind its new client to A.
Verify the offline navigation response stamp is A, PLANET_ROLLBACK_STATUS says engine=B/active=A, both COMPLETE markers and the persisted selection remain identical, and A executable bytes match in RU/EN/RU. Signed saved access, canonical Russia query/hash and the real one-Canvas scene stay intact within the reopened document. Do not compare scene identity across browser processes.
Compare bounded license POST ledger rows before close and after the offline checks. This proves no additional license POST reached the local server; it is not a claim that browser networking universally never attempted a request.

## Owned browser boundary

Reuse the established checkout .tmp realpath/lstat fence. New pwa-rollback-profile-* parent and its profile child are the only recursive cleanup target, after the owned context closes; no personal browser/OS install/profile/AVD or account changes.
Before navigation, both launches install the same-origin/data/blob page request fence with origin/path-only blocked metadata. Service-worker-handled traffic can bypass Playwright routes; the page fence is not a universal OS/network sandbox. The reopened launch itself is offline.
Expect two persistent launches, one browser-process restart and three captures: pwa-rollback-before-close.png, pwa-rollback-reopened-ru.png, pwa-rollback-reopened-en.png. These are PLANNED, not actual counts/PASS; capturesReviewed remains false until a separate authentic direct-review record exists.

## ROOT execution prerequisites

1. Review the exact append, config and proposal manifest; apply only the single owner through ROOT's current source guard, then bind the real committed HEAD/current declared source snapshot. Observed82e04 is only the source-read observation, not a future execution BASE.
2. Reuse an admitted current QA artifact only if its authority genuinely matches the still-live local server. Otherwise ROOT may justify ONE current QA build via startPwaQaServer({buildQa:true}); do not separately call build-pwa or stock playwright.pwa.config, whose webServer would create a second key/build.
3. Keep that one server/authority alive across update, rollback, close, reopen and control observations. Retain current artifact/source and strict-audit refs; do not copy authority/control secrets into evidence.
4. Bind unique existing output parents and S03_BROWSER_CHANNEL=msedge, PWA_QA_ORIGIN, PWA_QA_CONTROL_PATH, S03_D265_SOURCE_COMMIT, S03_PWA_OUTPUT, S03_PWA_REPORT. ROOT-owned execution command selects runtime/pwa.config.mjs through the installed Playwright CLI. No 203/139/163 suite, app TSC, old case, APK, OS installation, provider or deployment is required by this proposal.
5. Retain raw report/stdout/stderr, attachment, three PNG hashes/direct reviews and cleanup outcome. Assert exactly one selected successful case only if actually earned; retain any failed attempt unchanged. This is browser/profile lifecycle proof, not installed-device, PSP, full content/visual, stage or release acceptance.
