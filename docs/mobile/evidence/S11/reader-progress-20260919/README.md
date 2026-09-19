# Reader, storage and globe recovery checkpoint

The final `result.json` is produced by `checkpoint.mjs` only after the focused
reader/library/storage/globe runs, shared TypeScript check and exact-source
PWA/Android artifact preservation pass. Individual attempts are retained.

Reader progress uses a separate local key for each authenticated adult; the
unscoped legacy key stays with the guest. Hydration cannot overwrite a later
local edit, including reset to zero. Failed or timed-out uploads keep dirty local
intent. Timers belong to one item/account lifetime and do not retry indefinitely.
Cross-reader storage is reconciled before upload. Remote account/database ports
are controlled in tests; no live backend action or distributed ordering guarantee
is claimed.

Related evidence:

- `../optional-uninstall-20260919/result.json`: protected package retirement.
- `../older-package-20260919/result.json`: management of the previous saved version.
- `../reading-library-20260919/result.json`: favorite/status mutation ownership.
- `../globe-recovery-20260919/result.json`: the existing scene after WebGL loss.

The artifact runners preserve prior Wi-Fi builds and verify copied bytes on D:.
The PWA checks its actual cold offline RU/EN download panel. Android checks the
assembled APK, bundled assets, signature, alignment, locales and native class.
Neither proves installed-device behavior, iOS readiness or stage acceptance.
Production content activation and the final owner archive synchronization stay
separate. Only S00-S02 are accepted; release readiness remains false.
