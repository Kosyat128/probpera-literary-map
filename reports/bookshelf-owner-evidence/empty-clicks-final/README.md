# Final local empty-click regression

Production preview only: `http://127.0.0.1:4185`. Started 2026-09-05T18:04:16.55Z; 2 passed in 46.0 seconds, no failures, skips, retries or flaky results. The Playwright process exited 0 and closed its browsers.

The existing `stage5-baseline.spec.mjs` empty-click regression ran with one worker using the repository configuration and unchanged assertions. Desktop Chrome passed in 22.6 seconds; the unchanged Pixel 7 device preset passed in 19.6 seconds. The latter is Chrome device emulation, not a physical handset: viewport 412x839, deviceScaleFactor 2.625, isMobile and hasTouch enabled. Desktop uses 1280x720 at DPR 1. No live-site or software-renderer override was used.

Both cases verify closed/open book dismissal by an empty click and subsequent shelf focus. Desktop also verifies that modifier clicks, drags, returning drags and leaving/re-entering the canvas do not dismiss the selected book. This bounded result does not claim a rerun of the full browser suite. Application source was unchanged.

Exact machine-readable results are in `results.json`; terminal output is in `run.log`. Successful cases do not retain failure-only screenshots or traces under the existing configuration.

```powershell
$env:PLAYWRIGHT_PORT = '4185'
$env:PLAYWRIGHT_REUSE_SERVER = 'true'
$env:PLAYWRIGHT_JSON_OUTPUT_FILE = 'reports/bookshelf-owner-evidence/empty-clicks-final/results.json'
npx playwright test tests/e2e/stage5-baseline.spec.mjs --grep 'bookshelf empty clicks' --workers=1 --retries=0 --reporter=list,json --output=reports/bookshelf-owner-evidence/empty-clicks-final/test-results
```
